import parseArgs from "minimist"
import * as version from "./version"
import SSH2Promise from "@johnls/ssh2-promise"
import sshConfig from "ssh-config"
import os from "os"
import fs from "fs-extra"
import vm from "vm"
import path from "path"
import { Readable } from "stream"
import JSON5 from "@johnls/json5"
import autobind from "autobind-decorator"
import merge from "merge"
import * as asserters from "./asserters"
import util from "./util"
import { ScriptError } from "./ScriptError"

@autobind
export class OctopusTool {
  constructor(container = {}) {
    this.toolName = container.toolName
    this.fs = container.fs || fs
    this.log = container.log
    this.util = container.util || util
    this.asserters = container.asserters || asserters
    this.process = container.process || process
    this.createSsh =
      container.createSsh || ((options) => new SSH2Promise(options))
    this.sshConfig = container.sshConfig || sshConfig
    this.debug = container.debug
  }

  static installNodeScript = `#!/bin/bash
  VERSION=$(grep -Eo "\\(Red Hat|\\(Ubuntu" /proc/version)
  case $VERSION in
    "(Red Hat")
      curl -sL https://rpm.nodesource.com/setup_10.x | bash -
      yum clean all
      yum makecache fast
      yum install -y -q gcc-c++ make
      yum install -y -q nodejs
      ;;
    "(Ubuntu")
      curl -sL https://deb.nodesource.com/setup_10.x | bash -
      apt update
      apt install -y -q nodejs
      ;;
    *)
      echo Unsupported Linux distro
      exit 255
      ;;
  esac
`
  static minNodeVersion = "v10"

  async uploadFile(ssh, remotePath, contents) {
    const readStream = new Readable({
      read(size) {
        this.push(contents)
        this.push(null)
      },
    })
    const sftp = ssh.sftp()
    const writeStream = await sftp.createWriteStream(remotePath)

    await this.util.pipeToPromise(readStream, writeStream)
  }

  async assertHasNode(ssh) {
    let result = await this.util.runRemoteCommand(ssh, "node --version", {
      noThrow: true,
    })

    return (
      result.exitCode === 0 &&
      result.output.length > 0 &&
      result.output[0].startsWith(OctopusTool.minNodeVersion)
    )
  }

  async rectifyHasNode(ssh, sudoPassword) {
    let result = null

    this.log.info("Checking remote system clock")
    result = await this.util.runRemoteCommand(ssh, 'bash -c "echo /$(date)"', {
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

    const remoteTempFilePath = (await this.util.runRemoteCommand(ssh, "mktemp"))
      .output[0]

    this.log.info(
      `Created remote Node.js install script${
        this.debug ? " (" + remoteTempFilePath + ")" : ""
      }`
    )

    await this.uploadFile(
      ssh,
      remoteTempFilePath,
      OctopusTool.installNodeScript
    )

    this.log.info(`Running Node.js install script`)
    result = await this.util.runRemoteCommand(
      ssh,
      `bash ${remoteTempFilePath}`,
      {
        sudo: true,
        sudoPassword,
        noThrow: true,
      }
    )

    if (result.exitCode === 0) {
      result = await this.util.runRemoteCommand(ssh, "node --version", {
        noThrow: true,
      })

      if (
        result.exitCode === 0 &&
        result.output[0].startsWith(OctopusTool.minNodeVersion)
      ) {
        return
      }
    }

    throw new Error(
      `Unable to install Node.js ${OctopusTool.minNodeVersion} on remote host`
    )
  }

  async assertHasOctopus(ssh) {
    let result = await this.util.runRemoteCommand(ssh, "octopus --version", {
      noThrow: true,
    })

    return (
      result.exitCode === 0 &&
      result.output.length > 0 &&
      result.output[0].startsWith(version.shortVersion)
    )
  }

  async rectifyHasOctopus(ssh, sudoPassword) {
    this.log.info("Installing Octopus")
    let result = await this.util.runRemoteCommand(
      ssh,
      "npm install -g @johnls/octopus",
      {
        sudo: true,
        sudoPassword,
        noThrow: true,
      }
    )

    if (result.exitCode === 0) {
      result = await this.util.runRemoteCommand(ssh, "octopus --version", {
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
      `Unable to install Octopus ${version.shortVersion} on remote host`
    )
  }

  async readScriptFile(scriptPath) {
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

  async createRunContext(scriptNode, options = {}) {
    const { vars: varsNode } = scriptNode.value
    const osInfo = await this.util.osInfo()
    const runContext = vm.createContext({
      env: process.env,
      os: osInfo,
      user: this.util.userInfo(),
      sys: {
        scriptFile: scriptNode.filename,
        scriptDir: path.dirname(scriptNode.filename),
      },
      fs: {
        readFile: (fileName) =>
          this.fs.readFileSync(fileName, { encoding: "utf8" }),
      },
      path: {
        join: (...paths) => path.join(...paths),
        dirname: (filename) => path.dirname(filename),
      },
      vars: {},
    })
    const expandStringNode = (node) => {
      if (!node.type || node.type !== "string") {
        throw new Error("Must pass in a string node to expand")
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

    if (varsNode) {
      const processNode = (node, expand) => {
        if (node.value !== null && node.type === "object") {
          const newValue = {}

          Object.entries(node.value).map(([k, v]) => {
            newValue[k] = processNode(v, k === "local" ? true : expand)
          })

          return newValue
        } else if (node.type === "array") {
          return node.value.map((i) => processNode(i, expand))
        } else if (node.type === "string") {
          if (expand) {
            const newValue = expandStringNode(node)

            node.value = newValue
            return newValue
          } else {
            return node.value
          }
        } else {
          return node.value
        }
      }

      runContext.vars = processNode(varsNode, options.inRunScriptLocally)
    }

    return { runContext, expandStringNode }
  }

  async mergeIncludeNodes(scriptNode, scriptDir, includesNode) {
    if (!includesNode) {
      return
    }

    for (const includeNode of includesNode.value) {
      const newScriptNode = await this.readScriptFile(
        path.resolve(scriptDir, includeNode.value)
      )

      await this.mergeIncludeNodes(
        scriptNode,
        newScriptNode.filename,
        newScriptNode.includesNodes
      )

      const {
        settings: settingsNode,
        vars: varsNode,
        assertions: assertionsNode,
      } = scriptNode.value
      const {
        settings: newSettingsNode,
        vars: newVarsNode,
        assertions: newAssertionsNode,
      } = newScriptNode.value

      if (newSettingsNode) {
        settingsNode.value = merge.recursive(
          settingsNode.value,
          newSettingsNode.value
        )
      }
      if (newVarsNode) {
        varsNode.value = merge.recursive(varsNode.value, newVarsNode.value)
      }
      if (newAssertionsNode) {
        assertionsNode.value = [
          ...assertionsNode.value,
          ...newAssertionsNode.value,
        ]
      }
    }
  }

  async flattenScript(scriptNode) {
    const {
      includes: includesNode,
      settings: settingsNode,
      vars: varsNode,
      assertions: assertionsNode,
    } = scriptNode.value

    await this.mergeIncludeNodes(
      scriptNode,
      path.dirname(scriptNode.filename),
      includesNode
    )

    const settings = JSON5.simplify(settingsNode)
    const vars = JSON5.simplify(varsNode)
    const assertions = JSON5.simplify(assertionsNode)

    for (let i = 0; i < assertions.length; i++) {
      assertions[i]._assertNode = assertionsNode.value[i]
    }

    return {
      vars,
      settings,
      assertions,
    }
  }

  async runScriptLocally(scriptPath, options = {}) {
    const scriptNode = await this.readScriptFile(scriptPath)
    const state = await this.flattenScript(scriptNode)
    const scriptHasBecomes = state.assertions.find(
      (assertion) => assertion.become !== null
    )
    let sudo = null

    if (scriptHasBecomes) {
      if (!this.util.runningAsRoot()) {
        throw new Error(
          "Script requires becoming another user and it is not running as root"
        )
      }

      sudo = {
        uid: parseInt(this.process.env["SUDO_UID"]),
        gid: parseInt(this.process.env["SUDO_GID"]),
      }

      this.process.setegid(sudo.gid)
      this.process.seteuid(sudo.uid)
    }

    Object.assign(
      state,
      await this.createRunContext(scriptNode, { inRunScriptLocally: true })
    )

    if (this.debug) {
      this.log.info(JSON5.stringify(state.runContext.vars, null, "  "))
    }

    if (state.settings && state.settings.description) {
      this.log.output(
        JSON5.stringify({ description: state.settings.description })
      )
    }

    for (const assertion of state.assertions) {
      const asserter = new this.asserters[assertion.assert]({
        expandStringNode: state.expandStringNode,
      })

      const { when: whenNode } = assertion._assertNode.value

      if (whenNode) {
        if (
          (whenNode.type === "boolean" && !whenNode.value) ||
          (whenNode.type === "string" &&
            !state.expandStringNode(assertion._assertNode.value.when))
        ) {
          continue
        }
      }

      let output = {}
      let rectified = false

      if (assertion.become) {
        // TODO: Support becoming users other than root
        this.process.setegid(0)
        this.process.seteuid(0)
      } else if (sudo !== null) {
        this.process.setegid(sudo.gid)
        this.process.seteuid(sudo.uid)
      }

      if (!(await asserter.assert(assertion._assertNode))) {
        await asserter.rectify()
        rectified = true
        output.rectified = assertion.assert
      } else {
        output.asserted = assertion.assert
      }

      if (assertion.description) {
        output.description = assertion.description
      }

      output.result = asserter.result(rectified)
      this.log.output(JSON5.stringify(output))
    }

    if (sudo !== null) {
      this.process.setegid(sudo.gid)
      this.process.seteuid(sudo.uid)
    }
  }

  async getSshOptions(options) {
    const sshOptions = []
    const userInfo = os.userInfo()
    const sshConfigFile = `${process.env.HOME}/.ssh/config`
    const config = this.sshConfig.parse(
      await this.fs.readFile(sshConfigFile, { encoding: "utf8" })
    )
    const section = config.compute(options.host)

    if (section) {
      if (section.ProxyJump) {
        const proxySection = config.compute(section.ProxyJump)

        sshOptions.push({
          // Again, use config first, then passed in name
          host: proxySection.HostName || options.proxyHost,
          // Again, for these use command line first
          port:
            options.proxyPort || this.util.parsePort(proxySection.Port) || 22,
          username: options.user || proxySection.User || userInfo.username,
          identity:
            options.identity ||
            (section.IdentityFile &&
              this.util.expandTilde(section.IdentityFile[0])),
        })
      }

      sshOptions.push({
        // Here use config first, then passed in name
        host: section.HostName || options.host,
        // For these, use command line first
        port: options.port || parseInt(section.Port) || 22,
        username: options.user || section.User || userInfo.username,
        identity:
          options.identity ||
          (section.IdentityFile &&
            this.util.expandTilde(section.IdentityFile[0])),
      })
    }

    // Must ask for passwords if no identity supplied
    for (const sshOption of sshOptions) {
      if (!sshOption.identity) {
        const answers = await this.util.showPrompts("", "", "en-us", [
          {
            prompt: `${sshOption.username}@${sshOption.host}'s password:`,
            echo: false,
          },
        ])

        sshOption.password = answers[0]
      }
    }

    Object.assign(sshOptions[0], {
      agent: process.env["SSH_AUTH_SOCK"],
      showPrompts: this.util.showPrompts,
      //debug: this.debug ? (detail) => this.log.info(detail) : null,
    })

    return sshOptions
  }

  async runScriptRemotely(scriptPath, options = {}) {
    const scriptNode = await this.readScriptFile(scriptPath)
    const state = Object.assign(
      await this.flattenScript(scriptNode),
      await this.createRunContext(scriptNode, { inRunScriptLocally: false })
    )
    const newScript = JSON.stringify(
      {
        settings: state.settings,
        vars: state.runContext.vars,
        assertions: state.assertions,
      },
      (key, value) => (key.startsWith("_") ? undefined : value),
      this.debug ? "  " : null
    )
    const scriptHasBecomes = state.assertions.find(
      (assertion) => assertion.become !== null
    )

    if (this.debug) {
      this.log.info("Script after local processing:\n" + newScript)
    }

    let remoteTempFile = null
    let ssh = null
    let sshOptions = null

    try {
      sshOptions = await this.getSshOptions(options)

      const usingProxy = sshOptions.length > 1
      const remoteSshOptions = sshOptions[usingProxy ? 1 : 0]

      this.log.info(
        `Connecting to ${sshOptions[0].host}:${sshOptions[0].port} as ${sshOptions[0].username}`
      )

      if (usingProxy) {
        this.log.info(
          `Proxying to ${remoteSshOptions.host}:${remoteSshOptions.port} as ${remoteSshOptions.username}`
        )
      }

      ssh = this.createSsh(sshOptions)

      await ssh.connect()

      const sudoNeedsPassword = await this.util.doesSudoNeedPassword(ssh)
      const hasNode = await this.assertHasNode(ssh)
      const hasOctopus = hasNode && (await this.assertHasOctopus(ssh))
      const scriptNeedsSudo =
        options.runAsRoot || scriptHasBecomes || !hasNode || !hasOctopus
      let sudoPassword = null

      if (scriptNeedsSudo) {
        if (sudoNeedsPassword) {
          sudoPassword = remoteSshOptions.password

          if (!sudoPassword) {
            const answers = await this.util.showPrompts("", "", "en-us", [
              {
                prompt: `[sudo] ${remoteSshOptions.username}@${remoteSshOptions.host}'s password:`,
                echo: false,
              },
            ])

            sudoPassword = answers[0]
          }

          if (!(await this.util.canSudoWithPassword(ssh, sudoPassword))) {
            throw new Error("Cannot sudo with supplied password")
          }
        }

        if (!hasNode) {
          this.log.warning(`Node not found; attempting to rectify.`)
          await this.rectifyHasNode(ssh, sudoPassword)
        }

        if (!hasOctopus) {
          this.log.warning(
            `Octopus with version ${version.shortVersion} not found; attempting to rectify`
          )
          await this.rectifyHasOctopus(ssh, sudoPassword)
        }
      }

      remoteTempFile = (await this.util.runRemoteCommand(ssh, "mktemp"))
        .output[0]

      this.log.info(
        `Uploading remote script file${
          this.debug ? " (" + remoteTempFile + ")" : ""
        }`
      )

      await this.uploadFile(ssh, remoteTempFile, newScript)

      this.log.info(
        `Running Octopus script on remote${options.runAsRoot ? " as root" : ""}`
      )

      await this.util.runRemoteCommand(ssh, `octopus ${remoteTempFile}`, {
        sudo: options.runAsRoot,
        sudoPassword,
        log: this.log.output,
        logError: this.log.outputError,
        noThrow: true,
      })
    } finally {
      if (remoteTempFile && !this.debug) {
        this.log.info("Deleting remote temp file")
        await this.util.runRemoteCommand(ssh, `rm ${remoteTempFile}`)
      }

      if (ssh) {
        ssh.close()
      }

      if (sshOptions) {
        this.log.info(
          `Disconnected from ${sshOptions[0].host}:${sshOptions[0].port}`
        )
      }

      process.stdin.unref() // To free the Node event loop
    }
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version", "debug", "root"],
      string: [
        "host",
        "jump-host",
        "host-file",
        "user",
        "port",
        "jump-port",
        "identity",
      ],
      alias: {
        f: "host-file",
        h: "host",
        i: "identity",
        jh: "jump-host",
        p: "port",
        jp: "jump-port",
        r: "root",
        u: "user",
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

Runs an Octopus configuration script. If a host or host-file file is
given then the script will be run on those hosts using SSH. Node.js
and Octopus will be installed on the remote hosts if not already
present. For remote installation to work the '--root' argument must be
specified and the user must have sudo permissions on the remote host.

Arguments:
  --help              Shows this help
  --version           Shows the tool version
  --host, -h          Remote host name. Default is to run the script
                      directly, without a remote proxy
  --jump-host, -jh    Jump box host name
  --port, -p          Remote port number. Default is 22
  --jump-port, -jp    Jump box port number. Default is 22
  --user, -u          Remote user name. Defaults to current user
  --host-file, -f     JSON5 file containing multiple host names
  --root, -r          Start Octopus as root on remote host
`)
      return
    }

    if (args._.length !== 1) {
      throw new Error("Please specify just one script file")
    }

    const scriptPath = path.resolve(args._[0])

    if (
      (args.port || args.user || args.root || args.identity) &&
      !args.host &&
      !args["host-file"]
    ) {
      throw new Error(
        "'host' or 'host-file' must be specified with 'port', 'user', 'identity', 'jump-host' and 'root' arguments"
      )
    }

    let hosts = null

    if (args.host || args["host-file"]) {
      hosts = []

      if (args["host-file"]) {
        hosts = hosts.concat(JSON5.parse(fs.readFile(args["host-file"])))
      }

      if (args.host) {
        hosts.push({
          host: args.host,
          proxyHost: args.proxyHost,
          user: args.user,
          identity: args.identity,
          port: this.util.parsePort(args.port),
          proxyPort: this.util.parsePort(args.proxyPort),
          runAsRoot: args.root,
        })
      }
    }

    if (hosts) {
      let failures = 0

      for (const host of hosts) {
        try {
          await this.runScriptRemotely(scriptPath, {
            host: host.host,
            proxyHost: host.proxyHost,
            user: host.user,
            identity: host.identity,
            port: this.util.parsePort(host.port),
            proxyPort: this.util.parsePort(host.proxyHost),
            runAsRoot: host.runAsRoot,
          })
        } catch (error) {
          if (error) {
            this.log.error(error.message || error)

            if (this.debug) {
              console.error(error)
            }
          }

          failures += 1
        }
      }

      if (failures > 0) {
        throw new Error(`${failures} hosts were not updated`)
      }
    } else {
      await this.runScriptLocally(scriptPath)
    }
  }
}
