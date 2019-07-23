import parseArgs from "minimist"
import * as version from "./version"
import readlinePassword from "@johnls/readline-password"
import SSH2Promise from "ssh2-promise"
import os from "os"
import fs from "fs-extra"
import vm from "vm"
import { Readable } from "stream"
import JSON5 from "@johnls/json5"
import autobind from "autobind-decorator"
import * as asserters from "./asserters"

class ScriptError extends Error {
  constructor(message, fileName, node) {
    const lineNumber = node.line || 0
    const columnNumber = node.column || 0

    super(message, fileName, lineNumber, columnNumber)
    this.message += ` (${fileName}:${lineNumber}:${columnNumber})`
  }

  // Otherwise "Error: " is prefixed
  toString() {
    return this.message
  }
}

@autobind
export class OctopusTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  static installNodeScript = `#!/bin/bash
curl -sL https://deb.nodesource.com/setup_10.x -o ./nodesource_setup.sh
sudo bash ./nodesource_setup.sh
sudo apt -y -q install nodejs`

  // Assert the remote system has Node 10 installed
  async assertHasNode(ssh) {
    let result = await runRemoteCommand(ssh, "node --version", {
      noThrow: true,
    })

    return result.exitCode === 0 && result.stdout.trim().startsWith("v10")
  }

  async rectifyHasNode(ssh) {
    const password = ssh.config[0].password
    let stream = null

    this.log.info("Creating /opt/octopus directory")
    await runRemoteCommand(ssh, "mkdir -p /opt/octopus", {
      needsSudo: true,
      password,
    })

    this.log.info("Creating /opt/octopus/install_node.sh script")
    await runRemoteCommand(
      ssh,
      `bash -c 'echo "${OctopusTool.installNodeScript}" > ./install_node.sh'`,
      {
        cwd: "/opt/octopus",
        sudo: true,
        password,
      }
    )

    this.log.info("Running /opt/octopus/install_node.sh script")
    await runRemoteCommand(ssh, "bash ./install_node.sh", {
      cwd: "/opt/octopus",
      sudo: true,
      password,
    })
  }

  async assertHasOctopus(ssh) {
    let result = await runRemoteCommand(ssh, "octopus --version", {
      noThrow: true,
    })

    return (
      result.exitCode === 0 && result.stderr.trim().startsWith(version.version)
    )
  }

  async rectifyHasOctopus(ssh) {
    const password = ssh.config[0].password
    let stream = null

    this.log.info("Installing Octopus")
    await runRemoteCommand(ssh, "npm install -g @johnls/octopus", {
      sudo: true,
      password,
    })
  }

  async processScriptFile(scriptFile, options = {}) {
    const { onlyExpandLocalVars } = options
    const newScriptError = (message, node) => {
      return new ScriptError(message, scriptFile, node)
    }

    const scriptNodes = JSON5.parse(await fs.readFile(scriptFile), {
      wantNodes: true,
    })

    if (scriptNodes.type !== "object") {
      throw newScriptError(
        "Script must have an object as the root",
        scriptNodes
      )
    }

    const {
      options: optionsNode,
      vars: varsNode,
      assertions: assertionsNode,
    } = scriptNodes.value

    if (!assertionsNode) {
      this.log.warn("No 'assertions' found")
      return
    }

    if (assertionsNode.type !== "array") {
      throw newScriptError("'assertions' must be an array", assertionsNode)
    }

    const vmContext = {
      env: process.env,
      fs: {
        readFile: (fileName) => fs.readFileSync(fileName),
      },
    }
    const expandStringNode = (node) => {
      if (
        !node.value ||
        !node.type ||
        node.type !== "string" ||
        !node.line ||
        !node.column
      ) {
        throw new Error("Must pass in a string node to expand")
      }

      try {
        return new vm.Script("`" + node.value + "`").runInContext(
          vm.createContext(vmContext)
        )
      } catch (e) {
        throw newScriptError(e.message, node)
      }
    }

    if (optionsNode) {
      if (optionsNode.type !== "object") {
        throw newScriptError("'options' must be an object", optionsNode)
      }
      const { description: descriptionNode } = optionsNode.value
      if (descriptionNode) {
        if (descriptionNode.type !== "string") {
          throw newScriptError(
            "'options.description' must be a string",
            descriptionNode
          )
        }
      }
    }

    if (varsNode) {
      if (varsNode.type !== "object") {
        throw newScriptError("'vars' must be an object", varsNode)
      }
      for (const [key, varNode] of Object.entries(varsNode.value)) {
        if (vmContext[key] && typeof vmContext[key] === "object") {
          throw newScriptError(
            `Variable ${key} conflicts with a built-in object`,
            varNode
          )
        }

        switch (varNode.type) {
          case "null":
            delete vmContext[key]
            break
          case "numeric":
          case "boolean":
            vmContext[key] = varNode.value.toString()
            break
          case "string":
            vmContext[key] = onlyExpandLocalVars
              ? varNode.value
              : expandStringNode(varNode)
            break
          case "object":
            const valueNode = varNode.value.value

            if (!valueNode || valueNode.type !== "string") {
              throw newScriptError(
                `Variable object must have value field of type string`,
                varNode
              )
            }

            if (
              !onlyExpandLocalVars ||
              (onlyExpandLocalVars && varNode.value.local)
            ) {
              vmContext[key] = expandStringNode(valueNode)
            }
            break
          default:
            throw newScriptError(
              `Variable of type ${varNode.type} is invalid`,
              varNode
            )
        }
      }
    }

    let assertions = []

    for (const assertionNode of assertionsNode.value) {
      if (assertionNode.type !== "object") {
        throw newScriptError("Assertion must be an object", assertionNode)
      }

      const assertion = {}
      const {
        description: descriptionNode,
        assert: assertNode,
        with: withNode,
      } = assertionNode.value

      assertion.assertNode = assertNode
      assertion.withNode = withNode

      if (assertNode) {
        if (assertNode.type !== "string") {
          throw newScriptError(
            "Assertion 'assert' must be a string",
            assertNode
          )
        }
        assertion.name = assertNode.value
      } else {
        throw newScriptError("Assertion has no 'assert' value", assertNode)
      }

      if (descriptionNode) {
        if (descriptionNode.type !== "string") {
          throw newScriptError(
            "Assertion 'description' must be a string",
            descriptionNode
          )
        }
        assertion.description = descriptionNode.value
      }

      if (withNode) {
        if (withNode.type !== "object") {
          throw newScriptError("Assertion 'with' must be an object", withNode)
        }

        assertion.args = withNode.value
      }

      assertions.push(assertion)
    }

    return {
      script: JSON5.simplify(scriptNodes),
      assertions,
      vmContext,
      expandStringNode,
      newScriptError,
    }
  }

  async runScript(state, options) {
    const {
      script,
      assertions,
      vmContext,
      expandStringNode,
      newScriptError,
    } = state

    if (options.verbose) {
      const vars = {}

      Object.keys(vmContext).forEach((key) => {
        if (key === "env" || typeof vmContext[key] !== "object") {
          vars[key] = vmContext[key]
        }
      })
      this.log.info(JSON5.stringify(vars, null, "  "))
    }

    this.log.output(
      JSON5.stringify({ description: script.options.description })
    )

    for (const assertion of assertions) {
      const asserter = new asserters[assertion.name]({
        newScriptError,
        expandStringNode,
        assertNode: assertion.assertNode,
        withNode: assertion.withNode,
      })

      let ok = await asserter.assert(assertion.args)
      let output = {}

      if (!ok) {
        await asserter.rectify()

        output.rectified = assertion.name
      } else {
        output.asserted = assertion.name
      }

      if (assertion.description) {
        output.description = assertion.description
      }

      output.result = asserter.result()
      this.log.output(JSON5.stringify(output))
    }
  }

  async runOnHost(options) {
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

      this.log.info(
        `Connecting to ${sshConfig.host}:${sshConfig.port} as ${
          sshConfig.username
        }`
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

      ssh = new SSH2Promise(sshConfig)

      await ssh.connect()

      isConnected = true

      this.log.info(`Connected to ${sshConfig.host}:${sshConfig.port}`)

      if (!(await this.assertHasNode(ssh))) {
        this.log.warning(
          `Node not found on ${sshConfig.host}; attempting to rectify.`
        )
        await this.rectifyHasNode(ssh)
        await this.rectifyHasOctopus(ssh)
      } else if (options.verbose) {
        this.log.info(
          `Node.js is installed on ${sshConfig.host}:${sshConfig.port}`
        )
      }

      if (!(await this.assertHasOctopus(ssh))) {
        this.log.warning(
          `Octopus with version ${version.fullVersion} not found on ${
            sshConfig.host
          }:${sshConfig.port}; attempting to rectify`
        )
        await this.rectifyHasOctopus(ssh)
      } else if (options.verbose) {
        this.log.info(
          `Octopus is installed on ${sshConfig.host}:${sshConfig.port}`
        )
      }

      remoteTempFile = (await runRemoteCommand(ssh, "mktemp")).stdout.trim()

      this.log.info(
        `Created remote host script file${
          this.debug ? " - " + remoteTempFile : ""
        }`
      )

      const state = this.processScriptFile(options.scriptFile, {
        onlyExpandLocalVars: true,
      })

      const script = state.script

      for (const [key, value] of Object.entries(vmContext)) {
        if (typeof vmContext[key] !== "object") {
          script[key] = vmContext[key]
        }
      }

      let readStream = new Readable({
        read(size) {
          this.push(JSON.stringify(newScript))
          this.push(null)
        },
      })
      const sftp = ssh.sftp()
      let writeStream = await sftp.createWriteStream(remoteTempFile)

      await pipeToPromise(readStream, writeStream)

      const sudo =
        script.assertions &&
        script.assertions.find((assertion) => assertion.hasOwnProperty("runAs"))

      this.log.info(`Running script on remote host`)
      await runRemoteCommand(ssh, `octopus ${remoteTempFile}`, {
        sudo,
        password: sshConfig.password,
        log: this.log.output,
      })
    } finally {
      if (isConnected) {
        if (remoteTempFile && !this.debug) {
          this.log.info("Deleting remote temp file")
          await runRemoteCommand(ssh, `rm ${remoteTempFile}`)
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
      boolean: ["help", "version", "debug"],
      string: ["host", "host-file", "user", "port", "password", "set"],
      alias: {
        h: "host",
        u: "user",
        p: "port",
        f: "host-file",
        P: "password",
        s: "set",
      },
    }
    const args = parseArgs(argv, options)

    this.debug = args.debug

    if (args.version) {
      this.log.info(`${version.fullVersion}`)
      return 0
    }

    if (args.help) {
      this.log.info(`
Usage: ${this.toolName} [options] <script-file>

Description:

Runs an Octopus configuration script. If a host or host-file file is
given then the script will be run on those hosts using SSH. Node.js
and Octopus will be installed on the remote hosts if it is not already
present.  For this to work the given user must have sudo privileges on
the remote host.

Options:
  --help              Shows this help
  --version           Shows the tool version
  --host, -h          Remote host name. Default is to run the script
                      directly, without a remote proxy
  --port, -p          Remote port number. Default is 22
  --user, -u          Remote user name. Defaults to current user.
  --password, -P      Remote user password. Defaults is to just use PPK.
  --host-file, -f     JSON5 file containing multiple remote host names
  --verbose           Emit verbose output
  --set,-s            Set one or more variables
`)
      return 0
    }

    const scriptFile = args._[0]

    if (!scriptFile) {
      throw new Error("Please specify a script file")
    }

    const parsePort = (s) => {
      const port = parseInt(args.port)

      if (args.port && (port < 0 || port > 65535)) {
        throw new Error("Port must be a number between 0 and 65535")
      }

      return port
    }

    if (args.host || args["host-file"]) {
      let hosts = []

      if (args["host-file"]) {
        hosts = hosts.concat(JSON5.parse(fs.readFile(args["host-file"])))
      }

      if (args.host) {
        hosts.push({
          host: args.host,
          user: args.user,
          password: args.password,
          port: parsePort(args.port),
        })
      }

      let exitCode = 0

      for (const host of hosts) {
        exitCode += await this.runOnHost({
          scriptFile,
          host: host.host,
          user: host.user,
          password: host.password,
          port: parsePort(host.port),
          verbose: args.verbose,
        })
      }
    } else {
      const state = await this.processScriptFile(scriptFile)
      await this.runScript(state, { verbose: args.verbose })
    }

    return 0
  }
}

const pipeToPromise = (readable, writeable) => {
  const promise = new Promise((resolve, reject) => {
    readable.on("error", (error) => {
      reject(error)
    })
    writeable.on("error", (error) => {
      reject(error)
    })
    writeable.on("finish", (file) => {
      resolve(file)
    })
  })
  readable.pipe(writeable)
  return promise
}

/*
  Run a command on the remote system. Options are:

 {
    noThrow: boolean    // Do not throw on bad exit code
    log: boolean  // Send script output on STDOUT directly to this.log
    sudo: boolean       // Run this command under sudo
    password: string    // Password (if needed for sudo)
 }
*/
const runRemoteCommand = async (ssh, command, options = {}) => {
  let stderr = ""
  let stdout = ""

  try {
    const socket = await ssh.spawn(
      (options.cwd ? `cd ${options.cwd} 1> /dev/null 2> /dev/null;` : "") +
        (options.sudo ? "sudo " : "") +
        command +
        "; echo $? >&2",
      null,
      {
        pty: options.sudo && options.password,
      }
    )

    if (options.sudo && options.password) {
      socket.write(password + "\n")
      socket.end()
    }

    await new Promise((resolve, reject) => {
      socket
        .on("close", () => resolve({ stdout, stderr }))
        .on("error", reject)
        .on("data", (data) => {
          const lines = data.toString()

          stdout += lines

          if (options.log) {
            for (const line of lines.split("\n")) {
              if (line) {
                options.log(line)
              }
            }
          }
        }) // We have to read any data or the socket will block
        .stderr.on("data", (data) => {
          stderr += data
        })
    })
  } catch (error) {
    throw new Error(`Failed to run command '${command}'`)
  }

  const index = stderr.lastIndexOf("\n", stderr.length - 2)
  const exitCode = parseInt(stderr.slice(index + 1))

  if (!options.noThrow && exitCode !== 0) {
    throw new Error(`Command '${command}' returned exit code ${exitCode}`)
  }

  stderr = index <= 0 ? "" : stderr.slice(0, index)

  return { exitCode, stdout, stderr }
}
