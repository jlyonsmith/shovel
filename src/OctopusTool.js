import parseArgs from "minimist"
import { fullVersion } from "./version"
import readlinePassword from "@johnls/readline-password"
import SSH2Promise from "ssh2-promise"
import os from "os"
import autobind from "autobind-decorator"
import JSON5 from "json5"
import fs from "fs-extra"
import chalk from "chalk"

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
    let output = null

    try {
      output = await ssh.exec("node --version")
    } catch (error) {
      return false
    }

    return output.trim().startsWith("v10")
  }

  async rectifyHasNode(ssh) {
    const password = ssh.config[0].password
    let stream = null
    const commandComplete = (socket) => {
      return new Promise((resolve, reject) => {
        let buffer = ""
        socket
          .on("close", () => resolve(buffer))
          .on("error", reject)
          .on("data", (data) => {
            buffer += data
          }) // We have to read any data or the socket will block
          .stderr.on("data", (data) => {
            reject(data)
          })

        if (password) {
          socket.write(password + "\n")
          socket.end()
        }
      })
    }

    try {
      this.log.info("Creating /opt/octopus directory")
      stream = await ssh.spawn("sudo mkdir -p /opt/octopus", null, {
        pty: !!password,
      })
      await commandComplete(stream)
    } catch (error) {
      throw new Error("Unable to create /opt/octopus directory on remote")
    }

    try {
      this.log.info("Creating /opt/octopus/install_node.sh script")
      stream = await ssh.spawn(
        `cd /opt/octopus 1> /dev/null 2> /dev/null; sudo bash -c 'echo "${
          OctopusTool.installNodeScript
        }" > ./install_node.sh'`,
        null,
        {
          pty: !!password,
        }
      )
      await commandComplete(stream)
    } catch (error) {
      throw new Error("Unable to create install_node.sh file")
    }

    try {
      this.log.info("Running /opt/octopus/install_node.sh script")
      stream = await ssh.spawn(
        "cd /opt/octopus 1> /dev/null 2> /dev/null; sudo bash ./install_node.sh",
        null,
        { pty: !!password }
      )
      await commandComplete(stream)
    } catch (error) {
      throw new Error("Unsuccessful running install_node.sh")
    }

    if (!this.assertHasNode(ssh)) {
      throw new Error("Node installation failed")
    }
  }

  async bootstrapRemote(ssh, username, password, forceBootstrap) {
    const logResult = (result) => {
      this.log.info("STDOUT: " + result.stdout)
      this.log.info("STDERR: " + result.stderr)
    }

    this.log.info(`BOOTSTRAP: Moving Asserters to: /opt/octopus/asserters `)
    try {
      await ssh.putDirectory(
        `${__dirname}/asserters`,
        "/opt/octopus/asserters",
        { recursive: true }
      )
    } catch (e) {
      this.log.info(`Error copying: ${e}  ${ex.constructor.name}`)
    }

    let runBootstrap = true
    let nodeVersion = "unknown"

    if (!forceBootstrap) {
      this.log.info("BOOTSTRAP: Check if boostrap needs to be run")
      result = await ssh.execCommand("cat node_version.txt", {
        options: { pty: !!password },
        cwd: "/opt/octopus",
        stdin: password + "\n",
      })
      if (result.code == 0) {
        nodeVersion = result.stdout.split("\n")[1]
        runBootstrap = !(nodeVersion == OctopusTool.targetNodeVersion)
      }
    }
  }

  async processAssertions(ssh, username, password, assertScript) {
    assertScript = this.expandAssertVariables(assertScript)
    const vars = assertScript.vars || {}
    const asserts = assertScript.assertions || []
    let scriptSuccess = true
    let an
    let description
    for (an = 0; an < asserts.length; an++) {
      const assertionSpec = asserts[an]

      const assertionName = assertionSpec.assert
      description =
        assertionSpec.description || `Step ${an + 1}: (${assertionName})`
      const runAs = assertionSpec.runAs || ""

      const args = assertionSpec.with || {}
      const argsString = JSON.stringify(args)
      const args64 = Buffer.from(argsString).toString("base64")
      const sudo = runAs == "sudo" ? "sudo" : ""
      const command = `${sudo} node doAssert.js ${assertionName} base64 ${args64}`

      this.log.info(
        `=============================================================`
      )
      this.log.info(`>>> ${description}\n -------------------------------`)
      const assertSuccess = await this.runAssertion(
        ssh,
        username,
        password,
        command
      )
      if (!assertSuccess) {
        scriptSuccess = false
        break
      }
    }

    this.log.info(
      chalk.blue(
        `=============================================================`
      )
    )
    if (scriptSuccess) {
      this.log.info(chalk.green(">>> Script Completed Successfully"))
    } else {
      this.log.info(
        chalk.red(`>>> Script Failed at step ${an} (${description})`)
      )
    }
    this.log.info(
      chalk.blue(
        `=============================================================`
      )
    )
  }

  async runAssertion(ssh, username, password, command) {
    const result = await ssh.execCommand(command, {
      options: { pty: !!password },
      cwd: "/opt/octopus/asserters",
      stdin: password + "\n",
    })
    const success = result.code == 0
    const response = result.stdout
    if (success) {
      this.log.info(
        chalk.green(`Assertion Success: ${success}\nResponse:\n${response}`)
      )
    } else {
      this.log.info(
        chalk.red(`Assertion Success: ${success}\nResponse:\n${response}`)
      )
    }

    return success
  }

  expandAssertVariables(assertionScript) {
    const varExpander = (tpl, args) =>
      tpl.replace(/\${(\w+)}/g, (_, v) => args[v])
    const variables = assertionScript.vars || {}
    const assertions = assertionScript.assertions || {}
    const assertionsString = JSON.stringify(assertions)
    const expanded = varExpander(assertionsString, variables)
    return { vars: variables, assertions: JSON.parse(expanded) }
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version", "force-bootstrap", "debug"],
      string: ["host", "hosts-file", "user", "port", "password"],
      alias: {
        h: "host",
        u: "user",
        p: "port",
        f: "hosts-file",
        P: "password",
        F: "force-bootstrap",
      },
    }
    const args = parseArgs(argv, options)

    this.debug = args.debug

    if (args.version) {
      this.log.info(`${fullVersion}`)
      return 0
    }

    if (args.help) {
      this.log.info(`
Usage: ${this.toolName} [options] <script-file>

Description:

Runs an Octopus configuration script on one or more hosts over SSH.

Options:
  --help              Shows this help
  --version           Shows the tool version
  --host, -h          The SSH host name
  --user, -u          The SSH user name
  --port, -p          The SSH port number
  --password, -P      SSH password
  --hosts-file, -f    JSON5 file containing multiple host names
  --force-bootstrap, -F Force execution of node bootstrap
`)
      return 0
    }

    const scriptFile = args._[0]

    if (!scriptFile) {
      throw new Error("Please specify a script file")
    }

    //const forceBootstrap = args["force-bootstrap"]
    //const script = JSON5.parse(await fs.readFile(scriptFile))
    let isConnected = false
    let ssh = null

    try {
      const userInfo = os.userInfo()
      const sshConfig = {
        username: args.user || userInfo.username,
        host: args.host || "localhost",
        port: args.port ? parseInt(args.port) : 22,
        password: args.password,
        agent: process.env["SSH_AUTH_SOCK"],
        tryKeyboard: true,
        onKeyboardInteractive: async (
          name,
          instructions,
          instructionsLang,
          prompts,
          finish
        ) => {
          const rl = readlinePassword.createInstance(
            process.stdin,
            process.stdout
          )
          let responses = []

          for (const prompt of prompts) {
            responses.push(await rl.passwordAsync(prompt))
          }
          rl.close()
          finish(responses)
        },
        debug: this.debug ? (detail) => this.log.info(detail) : null,
      }

      ssh = new SSH2Promise(sshConfig)
      await ssh.connect()

      isConnected = true

      this.log.info(
        `Connected to '${sshConfig.username}@${sshConfig.host}:${
          sshConfig.port
        }'`
      )

      if (!(await this.assertHasNode(ssh))) {
        this.log.warning(
          `Node not found on '${sshConfig.host}'; attempting to rectify.`
        )
        await this.rectifyHasNode(ssh)
      } else {
        this.log.info(`Node is installed on '${sshConfig.host}'`)
      }
      //await this.bootstrapRemote(ssh, args.user, args.password, forceBootstrap)
      //await this.processAssertions(ssh, args.user, args.password, assertScript)
    } finally {
      if (isConnected) {
        ssh.close()
        this.log.info(
          `Disconnected from '${ssh.config[0].host}:${ssh.config[0].port}'`
        )
      }

      process.stdin.unref() // To free the Node event loop
    }

    return 0
  }
}
