import parseArgs from "minimist"
import * as version from "./version"
import { SSH } from "./ssh"
import { SFTP } from "./sftp"
import fs from "fs-extra"
import vm from "vm"
import path from "path"
import JSON5 from "@johnls/json5"
import * as asserters from "./asserters"
import util from "./util"
import { ScriptError } from "./ScriptError"
import semver from "semver"
import { bindMethods } from "."

export class ShovelTool {
  constructor(container = {}) {
    this.toolName = container.toolName
    this.fs = container.fs || fs
    this.log = container.log
    this.util = container.util || util
    this.asserters = container.asserters || asserters
    this.process = container.process || process
    this.createSsh = container.createSsh || ((options) => new SSH(options))
    this.createSftp = container.createSftp || ((options) => new SFTP(options))
    this.debug = container.debug
    bindMethods.call(this)
  }

  static minNodeVersion = "v10.17.0"
  static ltsNodeVersion = "v17.0.1"

  async assertHasNode(ssh) {
    let result = await ssh.run("node --version", {
      noThrow: true,
    })

    return (
      result.exitCode === 0 &&
      result.output.length > 0 &&
      semver.gte(semver.clean(result.output[0]), ShovelTool.minNodeVersion)
    )
  }

  async rectifyHasNode(ssh, sftp) {
    let result = null
    const nodeMajorVersion = semver.major(ShovelTool.ltsNodeVersion)
    const installNodeScript = `#!/bin/bash
    VERSION=$(grep -Eo "\\(Red Hat|\\(Ubuntu" /proc/version)
    case $VERSION in
      "(Red Hat")
        curl -sL https://rpm.nodesource.com/setup_${nodeMajorVersion}.x | bash -
        yum clean all
        yum makecache fast
        yum install -y -q make
        yum install -y -q nodejs node-gyp
        ;;
      "(Ubuntu")
        curl -sL https://deb.nodesource.com/setup_${nodeMajorVersion}.x | bash -
        apt update
        apt install -y -q g++ make
        apt install -y -q nodejs node-gyp
        ;;
      *)
        echo Unsupported Linux distro
        exit 255
        ;;
    esac
  `

    this.log.info("Checking remote system clock")
    result = await ssh.run('bash -c "echo /$(date)"', {
      noThrow: true,
    })

    if (
      result.exitCode !== 0 ||
      result.output.length === 0 ||
      !result.output[0].startsWith("/")
    ) {
      throw new Error("Unable to get remote host date & time")
    }

    const remoteDate = new Date(result.output[0].substring(1))
    const localDate = new Date()

    if (
      remoteDate.getFullYear() !== localDate.getFullYear() ||
      remoteDate.getMonth() !== localDate.getMonth() ||
      remoteDate.getDate() !== localDate.getDate()
    ) {
      throw new Error("Remote system clock is more than 24 hours out of sync.")
    }

    const remoteTempFilePath = (await ssh.run("mktemp")).output[0]

    this.log.info(
      `Created remote Node.js install script${
        this.debug ? " (" + remoteTempFilePath + ")" : ""
      }`
    )

    await sftp.putContent(remoteTempFilePath, installNodeScript)

    this.log.startSpinner("Installing")

    this.log.info(`Running Node.js install script; this could take a while`)
    result = await ssh.run(`bash ${remoteTempFilePath}`, {
      sudo: true,
      noThrow: true,
    })

    this.log.stopSpinner()

    if (result.exitCode === 0) {
      result = await ssh.run("node --version", {
        noThrow: true,
      })

      if (
        result.exitCode === 0 &&
        result.output[0] &&
        semver.gte(semver.clean(result.output[0]), ShovelTool.minNodeVersion)
      ) {
        return
      }
    }

    throw new Error(
      `Unable to install Node.js ${ShovelTool.ltsNodeVersion} on remote host`
    )
  }

  async assertHasShovel(ssh) {
    let result = await ssh.run("shovel --version", {
      noThrow: true,
    })

    return (
      result.exitCode === 0 &&
      result.output.length > 0 &&
      result.output[0].startsWith(version.shortVersion)
    )
  }

  async rectifyHasShovel(ssh) {
    this.log.info("Installing Shovel")
    this.log.startSpinner("Installing")

    // NOTE: See https://github.com/nodejs/node-gyp/issues/454#issuecomment-58792114 for why "--unsafe-perm"
    let result = await ssh.run("npm install -g --unsafe-perm @johnls/shovel", {
      sudo: true,
      noThrow: true,
    })

    this.log.stopSpinner()

    if (result.exitCode === 0) {
      result = await ssh.run("shovel --version", {
        noThrow: true,
      })

      if (
        result.exitCode === 0 &&
        result.output[0].startsWith(version.shortVersion)
      ) {
        return
      }
    }

    throw new Error(
      `Unable to install Shovel ${version.shortVersion} on remote host`
    )
  }

  async loadScriptFile(scriptPath) {
    const scriptNode = JSON5.parse(await this.fs.readFile(scriptPath), {
      wantNodes: true,
    })
    const createArrayNode = () => ({
      line: 0,
      column: 0,
      type: "array",
      value: [],
    })
    const createObjectNode = () => ({
      line: 0,
      column: 0,
      type: "object",
      value: {},
    })
    const addFilename = (node) => {
      node.filename = scriptPath

      switch (node.type) {
        case "null":
        case "number":
        case "boolean":
          break
        case "object":
          for (const [key, value] of Object.entries(node.value)) {
            addFilename(value)
          }
          break
        case "array":
          for (const value of node.value) {
            addFilename(value)
          }
          break
      }
    }

    if (scriptNode.type !== "object") {
      throw new ScriptError(
        "Script must have an object as the root",
        scriptNode
      )
    }

    let {
      includes: includesNode,
      settings: settingsNode,
      vars: varsNode,
      assertions: assertionsNode,
    } = scriptNode.value

    if (!includesNode) {
      scriptNode.value.includes = includesNode = createArrayNode()
    }

    if (!settingsNode) {
      scriptNode.value.settings = settingsNode = createObjectNode()
    }

    if (!varsNode) {
      scriptNode.value.vars = varsNode = createObjectNode()
    }

    if (!assertionsNode) {
      scriptNode.value.assertions = assertionsNode = createArrayNode([])
    }

    addFilename(scriptNode)

    if (includesNode.type !== "array") {
      throw new ScriptError("'include' must be an array", includesNode)
    }

    for (const includeNode of includesNode.value) {
      if (includeNode.type !== "string") {
        throw new ScriptError(
          "'include' array item must be a string",
          includeNode
        )
      }

      if (path.isAbsolute(includeNode.value)) {
        throw new ScriptError(
          "Absolute path for inclued is not allowed",
          includeNode
        )
      }
    }

    if (settingsNode.type !== "object") {
      throw new ScriptError("'settings' must be an object", settingsNode)
    }

    const { description: descriptionNode } = settingsNode.value

    if (descriptionNode && descriptionNode.type !== "string") {
      throw new ScriptError("'description' must be a string", descriptionNode)
    }

    if (varsNode.type !== "object") {
      throw new ScriptError("'vars' must be an object", varsNode)
    }

    if (assertionsNode.type !== "array") {
      throw new ScriptError("'assertions' must be an array", assertionsNode)
    }

    for (const assertionNode of assertionsNode.value) {
      if (assertionNode.type !== "object") {
        throw new ScriptError("Assertion must be an object", assertionNode)
      }

      const {
        description: descriptionNode,
        when: whenNode,
        assert: assertNode,
        with: withNode,
      } = assertionNode.value

      if (assertNode) {
        if (assertNode.type !== "string") {
          throw new ScriptError("'assert' must be a string", assertNode)
        }
      } else {
        throw new ScriptError("'assert' property is not present", assertionNode)
      }

      if (descriptionNode && descriptionNode.type !== "string") {
        throw new ScriptError("'description' must be a string", descriptionNode)
      }

      if (
        whenNode &&
        !(whenNode.type === "string" || whenNode.type === "boolean")
      ) {
        throw new ScriptError("'when' must be a string or boolean", whenNode)
      }

      if (withNode && withNode.type !== "object") {
        throw new ScriptError("'with' must be an object", withNode)
      }
    }

    return scriptNode
  }

  async createScriptContext(rootScriptPath) {
    const rootScriptDirPath = path.dirname(rootScriptPath)
    const scriptNodes = new Map()
    const scriptPaths = []
    let anyScriptHasBecomes = false

    const loadIncludeNode = async (includeNode) => {
      const scriptPath = includeNode.value

      // assert.ok(path.isAbsolute(scriptPath), "include must have absolute path")

      const relativeScriptPath = path.join(
        path.relative(rootScriptDirPath, path.dirname(scriptPath)),
        path.basename(scriptPath)
      )

      if (relativeScriptPath.startsWith(".")) {
        throw new ScriptError(
          "Cannot include script from a directory below root script",
          includeNode
        )
      }

      if (!scriptNodes.has(relativeScriptPath)) {
        const scriptNode = await this.loadScriptFile(scriptPath)

        scriptNodes.set(relativeScriptPath, scriptNode)

        anyScriptHasBecomes =
          anyScriptHasBecomes ||
          !!scriptNode.value.assertions.value.find((assertionNode) =>
            assertionNode.value.hasOwnProperty("become")
          )

        for (var includeNode of scriptNode.value.includes.value) {
          includeNode.value = path.resolve(rootScriptDirPath, includeNode.value)

          await loadIncludeNode(includeNode)
        }
      }

      scriptPaths.push(relativeScriptPath)
    }

    await loadIncludeNode({
      filename: rootScriptPath,
      line: 0,
      column: 0,
      type: "string",
      value: rootScriptPath,
    })

    return {
      rootScriptDirPath,
      scriptNodes,
      scriptPaths,
      anyScriptHasBecomes,
    }
  }

  async createRunContext() {
    const osInfo = await this.util.osInfo()
    const runContext = vm.createContext({
      vars: {},
      env: Object.assign({}, this.process.env),
      os: osInfo,
      user: this.util.userInfo(),
      sys: {},
      fs: {
        readFile: (fileName) =>
          this.fs.readFileSync(fileName, { encoding: "utf8" }),
      },
      path: {
        join: (...paths) => path.join(...paths),
        dirname: (filename) => path.dirname(filename),
      },
      results: [],
    })
    const interpolator = (node) => {
      if (!node.type || node.type !== "string") {
        throw new Error("Can only interpolate string nodes")
      }

      if (node.value.startsWith("{") && node.value.endsWith("}")) {
        try {
          return new vm.Script(node.value).runInContext(runContext)
        } catch (e) {
          throw new ScriptError(`Bad script. ${e.message}`, node)
        }
      } else {
        return node.value
      }
    }

    runContext.results.last = function () {
      return this[this.length - 1]
    }

    return { runContext, interpolator }
  }

  updateRunContext(runContext, interpolator, scriptNode, options = {}) {
    const flattenNodes = (node, withInterpolation) => {
      if (node.value !== null && node.type === "object") {
        const newValue = {}

        Object.entries(node.value).map(([k, v]) => {
          newValue[k] = flattenNodes(
            v,
            k === "local" ? true : withInterpolation
          )
        })

        return newValue
      } else if (node.type === "array") {
        return node.value.map((i) => flattenNodes(i, withInterpolation))
      } else if (node.type === "string") {
        if (withInterpolation) {
          const newValue = interpolator(node)

          node.value = newValue
          return newValue
        } else {
          return node.value
        }
      } else {
        return node.value
      }
    }

    Object.assign(runContext.sys, {
      scriptFile: scriptNode.filename,
      scriptDir: path.dirname(scriptNode.filename),
    })

    const { vars: varsNode } = scriptNode.value

    Object.assign(
      runContext.vars,
      flattenNodes(varsNode, !!!options.interpolateOnlyLocalVars)
    )
  }

  async runScriptLocally(rootScriptPath, options = {}) {
    const scriptContext = await this.createScriptContext(rootScriptPath)
    let sudo = null

    if (!options.noSpinner) {
      this.log.enableSpinner()
    }

    if (scriptContext.anyScriptHasBecomes) {
      if (!this.util.runningAsRoot()) {
        throw new Error(
          "Script or included script requires becoming another user and it is not running as root"
        )
      }

      sudo = {
        uid: parseInt(this.process.env["SUDO_UID"]),
        gid: parseInt(this.process.env["SUDO_GID"]),
      }

      this.process.setegid(sudo.gid)
      this.process.seteuid(sudo.uid)
    }

    let { runContext, interpolator } = await this.createRunContext()

    for (var scriptPath of scriptContext.scriptPaths) {
      const scriptNode = scriptContext.scriptNodes.get(scriptPath)

      this.updateRunContext(runContext, interpolator, scriptNode)

      if (this.debug && Object.keys(runContext.vars).length > 0) {
        this.log.info(JSON5.stringify(runContext.vars, null, "  "))
      }

      const { assertions: assertionsNode, settings: settingsNode } =
        scriptNode.value

      if (Object.keys(settingsNode.value).length > 0) {
        const { when: whenNode, description: descriptionNode } =
          settingsNode.value

        if (descriptionNode) {
          this.log.output(`\{ description: "${descriptionNode.value}" \}`)
        }

        if (
          whenNode &&
          ((whenNode.type === "boolean" && !whenNode.value) ||
            (whenNode.type === "string" && !interpolator(whenNode)))
        ) {
          this.log.info(
            `Not running '${scriptPath}' because settings.when is false`
          )
          return
        }
      }

      this.log.info(`Running '${scriptPath}'`)

      for (const assertionNode of assertionsNode.value) {
        const {
          assert: assertNode,
          when: whenNode,
          become: becomeNode,
          description: descriptionNode,
        } = assertionNode.value

        if (whenNode) {
          if (
            (whenNode.type === "boolean" && !whenNode.value) ||
            (whenNode.type === "string" && !interpolator(whenNode))
          ) {
            continue
          }
        }

        const Asserter = this.asserters[assertNode.value]

        if (!Asserter) {
          throw new ScriptError(
            `${assertNode.value} is not a valid asserter`,
            assertionNode
          )
        }

        const asserter = new Asserter({
          interpolator,
          runContext,
        })
        let output = {}
        let rectified = false

        if (
          !assertionNode.value.with ||
          assertionNode.value.with.type !== "object"
        ) {
          throw new ScriptError(
            `Assertion must have a 'with' property of type object`,
            assertionNode
          )
        }

        if (becomeNode && becomeNode.value) {
          this.process.setegid(0)
          this.process.seteuid(0)
        } else if (sudo !== null) {
          this.process.setegid(sudo.gid)
          this.process.seteuid(sudo.uid)
        }

        if (options.noSpinner) {
          this.log.info(`> ${assertNode.value}`)
        } else {
          this.log.startSpinner(assertNode.value)
        }

        if (!(await asserter.assert(assertionNode))) {
          if (options.assertOnly) {
            output.wouldRectify = assertNode.value
          } else {
            await asserter.rectify()
            rectified = true
            output.rectified = assertNode.value
          }
        } else {
          output.asserted = assertNode.value
        }

        if (descriptionNode) {
          output.description = descriptionNode.value
        }

        output.result = asserter.result(rectified)

        runContext.results.push(output.result)

        this.log.output(JSON5.stringify(output))
      }

      if (sudo !== null) {
        this.process.setegid(sudo.gid)
        this.process.seteuid(sudo.uid)
      }
    }
  }

  async runScriptRemotely(rootScriptPath, options) {
    const scriptContext = await this.createScriptContext(rootScriptPath)

    if (!options.noSpinner) {
      this.log.enableSpinner()
    }

    // Things that need to be accessed in finally
    let ssh = null
    let sftp = null
    let remoteTempDir = null

    try {
      this.log.info(`Connecting to ${options.host}`)

      ssh = this.createSsh({ debug: this.debug })

      const connectOptions = {
        host: options.host,
        port: options.port,
        user: options.user,
        identity: options.identity,
      }

      await ssh.connect(connectOptions)

      sftp = this.createSftp({ debug: this.debug })

      await sftp.connect(
        Object.assign(connectOptions, {
          loginPasswordPrompts: ssh.loginPasswordPrompts,
        })
      )

      const hasNode = await this.assertHasNode(ssh)
      const hasShovel = hasNode && (await this.assertHasShovel(ssh))

      if (!hasNode) {
        this.log.warning(`Node not found; attempting to rectify.`)
        await this.rectifyHasNode(ssh, sftp)
      }

      if (!hasShovel) {
        this.log.warning(
          `Shovel with version ${version.shortVersion} not found; attempting to rectify`
        )
        await this.rectifyHasShovel(ssh)
      }

      remoteTempDir = (await ssh.run("mktemp -d")).output[0]

      if (this.debug) {
        this.log.debug(`Created remote script directory '${remoteTempDir}'`)
      }

      let { runContext, interpolator } = await this.createRunContext()

      for (const scriptPath of scriptContext.scriptPaths) {
        const scriptNode = scriptContext.scriptNodes.get(scriptPath)

        this.updateRunContext(runContext, interpolator, scriptNode, {
          interpolateOnlyLocalVars: true,
        })

        // Put the includes back to being relative paths
        for (const includeNode of scriptNode.value.includes.value) {
          includeNode.value =
            "." +
            includeNode.value.substring(scriptContext.rootScriptDirPath.length)
        }

        const scriptContent = JSON5.stringify(
          JSON5.simplify(scriptNode),
          null,
          this.debug ? "  " : undefined
        )
        const remoteScriptPath = path.join(remoteTempDir, scriptPath)

        await sftp.putContent(remoteScriptPath, scriptContent)

        if (this.debug) {
          this.log.debug(`Uploaded ${path.join(remoteTempDir, scriptPath)}:`)
          scriptContent.split(/\n/g).forEach((line, i) => {
            this.log.debug(
              i.toString().padStart(3, " ") + ": " + line.trimEnd()
            )
          })
        }
      }

      const remoteRootScriptPath = path.join(
        remoteTempDir,
        scriptContext.scriptPaths[scriptContext.scriptPaths.length - 1]
      )

      this.log.info(
        `Running script on host${
          scriptContext.anyScriptHasBecomes ? " as root" : ""
        }`
      )

      await ssh.run(
        `shovel --noSpinner${
          options.assertOnly ? " --assertOnly " : " "
        }${remoteRootScriptPath}`,
        {
          sudo: scriptContext.anyScriptHasBecomes,
          logOutput: this.log.output,
          logError: this.log.outputError,
          logStart: this.log.startSpinner,
          noThrow: true,
        }
      )
    } finally {
      if (remoteTempDir) {
        if (this.debug) {
          this.log.info(`Deleting remote script directory '${remoteTempDir}'`)
        }

        await ssh.run(`rm -rf ${remoteTempDir}`)
      }

      if (sftp) {
        sftp.close()
      }

      ssh.close()
      this.log.info(`Disconnected from ${options.host}`)
    }
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version", "debug", "assertOnly", "noSpinner"],
      string: ["host", "hostFile", "user", "port", "identity"],
      alias: {
        a: "assertOnly",
        f: "hostFile",
        h: "host",
        i: "identity",
        p: "port",
        u: "user",
        d: "debug",
      },
    }
    const args = parseArgs(argv, options)

    this.debug = args.debug

    if (args.version) {
      this.log.info(`${version.fullVersion}`)
      return
    }

    if (args.help) {
      this.log.info(`
Usage: ${this.toolName} [options] <script-file>

Description:

Runs a Shovel configuration script. If 'host' or 'hostFile' argument
is given then the script will be run on those hosts using SSH. If not
then the script will be run directly on the machine without SSH.

Node.js and Shovel will be installed on the remote hosts if not already
present. For installation to work the SSH user must have sudo
permissions on the host. If passwords are required for login or
sudo the tool will prompt.

Arguments:
  --help                    Shows this help
  --version                 Shows the tool version
  --host, -h <host>         Remote host name. Default is to run the script
                            directly on the local system
  --port, -p <port>         Remote port number; default is 22
  --user, -u <user>         Remote user name; defaults to current user
  --identity, -i <key>      User identity file
  --hostFile, -f <file>     JSON5 file containing multiple host names
  --assertOnly, -a          Only run assertions, don't rectify
  --noSpinner               Disable spinner animation
`)
      return
    }

    if (args._.length !== 1) {
      throw new Error("Please specify just one script file")
    }

    const scriptPath = path.resolve(args._[0])

    if (
      (args.port || args.user || args.identity) &&
      !args.host &&
      !args.hostFile
    ) {
      throw new Error(
        "'host' or 'hostFile' must be specified with 'port', 'user', 'identity' and arguments"
      )
    }

    let hosts = null

    if (args.host || args.hostFile) {
      hosts = []

      if (args.hostFile) {
        hosts = hosts.concat(JSON5.parse(await this.fs.readFile(args.hostFile)))
      }

      if (args.host) {
        hosts.push({
          host: args.host,
          port: this.util.parsePort(args.port),
          user: args.user,
          identity: args.identity,
        })
      }
    }

    if (hosts) {
      let failures = 0

      for (const host of hosts) {
        try {
          await this.runScriptRemotely(scriptPath, {
            host: host.host,
            port: this.util.parsePort(host.port),
            user: host.user,
            identity: host.identity,
            assertOnly: args.assertOnly,
          })
        } catch (error) {
          this.log.error(this.debug ? error : error.message)
          failures += 1
        }
      }

      if (failures > 0) {
        throw new Error(`${failures} hosts were not updated`)
      }
    } else {
      await this.runScriptLocally(scriptPath, {
        noSpinner: args.noSpinner,
        assertOnly: args.assertOnly,
      })
    }
  }
}
