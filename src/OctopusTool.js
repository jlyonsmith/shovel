import parseArgs from "minimist"
import { fullVersion } from "./version"
import readlinePassword from "@johnls/readline-password"
import NodeSSH from "node-ssh"
import os from "os"
import autobind from "autobind-decorator"
import validate from "./Validator"

// TODO: use import syntax without breaking the ability to import json5 files
require("json5/lib/register")
const assertions = require("../tests/install-consul.json5")

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
Usage: ${this.toolName} [options] <assertion-file>

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

    const validityCheck = validate(assertions, this.validationConstraints)
    let validationMessage =
      validityCheck || "Validation complete: no errors found."
    console.log("_________*****___________", validationMessage)

    let password = args.password
    let attempts = 0
    let success = false
    const userInfo = os.userInfo()
    let ssh = new NodeSSH()

    try {
      await ssh.connect({
        username: args.user || userInfo.username,
        host: args.host || "localhost",
        port: args.port ? parseInt(args.port) : 22,
        password,
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
      })
      this.log.info("BEGIN")
      const result = await ssh.exec("uptime", [], {
        onStdout: (chunk) => {
          this.log.info("STDOUT: " + chunk.toString("utf8"))
        },
        onStderr: (chunk) => {
          this.log.info("STDERR: " + chunk.toString("utf8"))
        },
      })
    } finally {
      if (ssh) {
        ssh.dispose()
        this.log.info("END")
      }

      process.stdin.unref() // To free the Node event loop
    }

    return 0
  }
}
