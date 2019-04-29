import parseArgs from "minimist"
import { fullVersion } from "./version"
import readlinePassword from "@johnls/readline-password"
import NodeSSH from "node-ssh"
import os from "os"
import autobind from "autobind-decorator"

@autobind
export class OctopusTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  async connectToHost(options) {
    const ssh = new NodeSSH()

    await ssh.connect({
      host: options.hostname,
      port: options.port,
      username: options.username,
      password: options.password,
      agent: options.authSock,
      tryKeyboard: !!options.keyboardInteractive,
      debug: this.debug ? (detail) => this.log.info(detail) : null,
      onKeyboardInteractive: options.onKeyboardInteractive,
    })

    return ssh
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
  --host              The SSH host name
  --user              The SSH user name
  --port              The SSH port number
  --password          SSH password
  --hosts-file        JSON5 file containing multiple host names
`)
      return 0
    }

    let password = args.password
    let attempts = 0
    let success = false
    const userInfo = os.userInfo()
    let ssh = null

    try {
      ssh = await this.connectToHost({
        username: args.user || userInfo.username,
        hostname: args.host || "localhost",
        port: args.port ? parseInt(args.port) : 22,
        password,
        authSock: process.env["SSH_AUTH_SOCK"],
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
