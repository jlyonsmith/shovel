import parseArgs from "minimist"
import { fullVersion } from "./version"
import readlinePassword from "@johnls/readline-password"
import NodeSSH from "node-ssh"
import os from "os"
import autobind from "autobind-decorator"
import validate from "./Validator"
import JSON5 from "json5"
import fs from "fs-extra"

@autobind
export class OctopusTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
    this.validationConstraints = {
      description: {
        isString: true,
      },
      vars: {
        isObject: true,
      },
      assertions: {
        presence: true,
        isArray: true,
        isAssertion: true, // an assertion contains an "assert" object and a "with" object
      },
    }
  }

  static bootstrapScript = `#!/bin/bash
curl -sL https://deb.nodesource.com/setup_10.x -o ./nodesource_setup.sh
sudo bash ./nodesource_setup.sh
sudo apt -y -q install nodejs
node --version > node_version.txt`

  async createConnection(options) {
    let ssh = new NodeSSH()

    await ssh.connect({
      username: options.username,
      host: options.host,
      port: options.port,
      password: options.password,
      agent: options.agent,
      tryKeyboard: !!options.onKeyboardInteractive,
      onKeyboardInteractive: options.onKeyboardInteractive,
      debug: this.debug ? (detail) => this.log.info(detail) : null,
    })

    this.log.info(
      `CONNECTED: ${options.username}@${options.host}:${options.port}`
    )

    return ssh
  }

  async bootstrapRemote(ssh, password) {
    const logResult = (result) => {
      this.log.info("STDOUT: " + result.stdout)
      this.log.info("STDERR: " + result.stderr)
    }
    this.log.info("BOOTSTRAP: Creating /opt/octopus directory")
    const result = await ssh.execCommand("sudo mkdir -p /opt/octopus", {
      options: { pty: !!password },
      stdin: password + "\n",
    })
    if (result.code !== 0) {
      logResult(result)
    }

    this.log.info("BOOTSTRAP: Creating /opt/octopus/bootstrap.sh script")
    await ssh.execCommand(
      `sudo bash -c 'echo "${OctopusTool.bootstrapScript}" > ./bootstrap.sh'`,
      {
        options: { pty: !!password },
        cwd: "/opt/octopus",
        stdin: password + "\n",
      }
    )
    if (result.code !== 0) {
      logResult(result)
    }

    this.log.info("BOOTSTRAP: Running /opt/octopus/bootstrap.sh script")
    await ssh.execCommand("sudo bash ./bootstrap.sh", {
      options: { pty: !!password },
      cwd: "/opt/octopus",
      stdin: password + "\n",
    })
    if (result.code !== 0) {
      logResult(result)
    }
  }

  async processAssertions(ssh, assertContents) {
    // TEMP grab first assertion which is directoryExists
    const testAssertion = assertContents.assertions[0]
    const asserter = new DirectoryExists()
    const assertionPassed = await asserter.assert(testAssertion.with)

    if (!assertionPassed) {
      this.log.info("ACTUALIZING")
      await asserter.actualize(testAssertion.with)
    }
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version"],
      string: ["host", "hosts-file", "user", "port", "password"],
      alias: {
        h: "host",
        u: "user",
        p: "port",
        f: "hosts-file",
        P: "password",
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
`)
      return 0
    }

    const assertFile = args._[0]

    if (!assertFile) {
      throw new Error("Please specify a script file")
    }

    const assertContents = JSON5.parse(await fs.readFile(assertFile))
    const validityCheck = validate(assertContents, this.validationConstraints)
    let validationMessage =
      validityCheck || "Validation complete: no errors found."
    let ssh = null

    try {
      const userInfo = os.userInfo()

      ssh = await this.createConnection({
        username: args.user || userInfo.username,
        host: args.host || "localhost",
        port: args.port ? parseInt(args.port) : 22,
        password: args.password,
        agent: process.env["SSH_AUTH_SOCK"],
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
      })

      await this.bootstrapRemote(ssh, args.password)
      await this.processAssertions(ssh, assertContents)
    } finally {
      if (ssh) {
        ssh.dispose()
        this.log.info("DISCONNECTED")
      }

      process.stdin.unref() // To free the Node event loop
    }

    return 0
  }
}
