import parseArgs from "minimist"
import * as version from "./version"
import readlinePassword from "@johnls/readline-password"
import SSH2Promise from "@johnls/ssh2-promise"
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
    this.createSSH =
      container.createSSH || ((sshConfig) => new SSH2Promise(sshConfig))
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

  async assertCanSudoOnHost(ssh) {
    const result = await this.util.runRemoteCommand(
      ssh,
      "bash -c 'echo /$EUID'", // Make output look like a path
      {
        sudo: true,
        password: ssh.config[0].password,
        noThrow: true,
      }
    )

    if (result.exitCode !== 0 || result.output[0] !== "/0") {
      throw new Error(
        `User ${ssh.config[0].username} does not have sudo ability on remote system`
      )
    }
  }

  async uploadFile(ssh, remotePath, contents) {
    const readStream = new Readable({
      read(size) {
        this.push(contents)
        this.push(null)
      },
    })
    const sftp = ssh.sftp()
    const writeStream = await sftp.createWriteStream(remotePath)

    await util.pipeToPromise(readStream, writeStream)
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

  async rectifyHasNode(ssh) {
    const password = ssh.config[0].password
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

    await this.assertCanSudoOnHost(ssh)

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
        password,
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

  async rectifyHasOctopus(ssh, options = {}) {
    if (!options.canSudoOnHost) {
      await this.assertCanSudoOnHost(ssh)
    }

    const password = ssh.config[0].password

    this.log.info("Installing Octopus")
    let result = await this.util.runRemoteCommand(
      ssh,
      "npm install -g @johnls/octopus",
      {
        sudo: true,
        password,
        noThrown: true,
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
        readFile: (fileName) => fs.readFileSync(fileName, { encoding: "utf8" }),
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

    const processNode = (node, expand) => {
      if (node.type === "object") {
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

    if (varsNode) {
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
    let sudo = null

    if (state.assertions.find((assertion) => assertion.become) !== null) {
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

  async runScriptRemotely(scriptPath, options = {}) {
    let isConnected = false
    let ssh = null
    let remoteTempFile = null
    const showPrompts = async (name, instructions, lang, prompts) => {
      const rl = readlinePassword.createInstance(process.stdin, process.stdout)
      let responses = []

      for (const prompt of prompts) {
        responses.push(await rl.passwordAsync(prompt))
      }
      rl.close()
      return responses
    }
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

    if (this.debug) {
      this.log.info("Script after local processing:\n" + newScript)
    }

    try {
      const userInfo = os.userInfo()
      const sshConfig = {
        username: options.user || userInfo.username,
        host: options.host || "localhost",
        port: options.port || 22,
        password: options.password,
        agent: process.env["SSH_AUTH_SOCK"],
        showPrompts,
        //debug: this.debug ? (detail) => this.log.info(detail) : null,
      }

      // TODO: Support connecting through a jump box

      this.log.info(
        `Connecting to ${sshConfig.host}:${sshConfig.port} as ${sshConfig.username}`
      )

      if (!sshConfig.password) {
        const answers = await showPrompts("", "", "en-us", [
          {
            prompt: `${sshConfig.username}:${sshConfig.host}'s password:`,
            echo: false,
          },
        ])

        sshConfig.password = answers[0]
      }

      ssh = this.createSSH(sshConfig)

      await ssh.connect()

      isConnected = true

      this.log.info(`Connected to ${sshConfig.host}:${sshConfig.port}`)

      let installedNode = false

      if (!(await this.assertHasNode(ssh))) {
        this.log.warning(
          `Node not found on ${sshConfig.host}:${sshConfig.port}; attempting to rectify.`
        )
        await this.rectifyHasNode(ssh)
        installedNode = true
      } else if (this.debug) {
        this.log.info(
          `Node.js is installed on ${sshConfig.host}:${sshConfig.port}`
        )
      }

      if (!(await this.assertHasOctopus(ssh))) {
        this.log.warning(
          `Octopus with version ${version.shortVersion} not found on ${sshConfig.host}:${sshConfig.port}; attempting to rectify`
        )
        await this.rectifyHasOctopus(ssh, { canSudoOnHost: installedNode })
      } else if (this.debug) {
        this.log.info(
          `Octopus is installed on ${sshConfig.host}:${sshConfig.port}`
        )
      }

      const remoteTempFile = (await this.util.runRemoteCommand(ssh, "mktemp"))
        .output[0]

      this.log.info(
        `Created remote host script file${
          this.debug ? " (" + remoteTempFile + ")" : ""
        }`
      )

      await this.uploadFile(ssh, remoteTempFile, newScript)

      // TODO: Need ability to run SFTP commands if remote script requests it

      this.log.info(
        `Running script on remote host as ${
          options.runAsRoot ? "root" : sshConfig.username
        }`
      )
      await this.util.runRemoteCommand(ssh, `octopus ${remoteTempFile}`, {
        sudo: options.runAsRoot,
        password: sshConfig.password,
        log: this.log.output,
        logError: this.log.outputError,
        noThrow: true,
      })
    } finally {
      if (isConnected) {
        if (remoteTempFile && !this.debug) {
          this.log.info("Deleting remote temp file")
          await this.util.runRemoteCommand(ssh, `rm ${remoteTempFile}`)
        }

        ssh.close()
        this.log.info(
          `Disconnected from ${ssh.config[0].host}:${ssh.config[0].port}`
        )
      }

      process.stdin.unref() // To free the Node event loop
    }
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version", "debug", "root"],
      string: ["host", "host-file", "user", "port", "password"],
      alias: {
        h: "host",
        u: "user",
        p: "port",
        f: "host-file",
        P: "password",
        r: "root",
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
present. For remote installation to work the 'root' argument must be
specified and the user must have sudo permissions on the remote host.

Arguments:
  --help              Shows this help
  --version           Shows the tool version
  --host, -h          Remote host name. Default is to run the script
                      directly, without a remote proxy
  --port, -p          Remote port number. Default is 22
  --user, -u          Remote user name. Defaults to current user.
  --password, -P      Remote user password. Defaults is to just use PPK.
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
      (args.port || args.user || args.password || args.root) &&
      !args.host &&
      !args["host-file"]
    ) {
      throw new Error(
        "'host' or 'host-file' must be specified with 'port', 'user', 'password' and 'root' arguments"
      )
    }

    const parsePort = (s) => {
      const port = parseInt(args.port)

      if (args.port && (port < 0 || port > 65535)) {
        throw new Error("Port must be a number between 0 and 65535")
      }

      return port
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
          user: args.user,
          password: args.password,
          port: parsePort(args.port),
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
            user: host.user,
            password: host.password,
            port: parsePort(host.port),
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
