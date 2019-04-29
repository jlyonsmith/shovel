import parseArgs from "minimist"
import { fullVersion } from "./version"
import readlinePassword from "@johnls/readline-password"
import { Client as SSHClient } from "ssh2"
import os from "os"
import autobind from "autobind-decorator"
import { tsParenthesizedType } from "@babel/types"

@autobind
export class OctopusTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  execOnHost(options) {
    const connection = new SSHClient()

    return new Promise((resolve, reject) => {
      connection
        .on("ready", () => {
          this.log.info("BEGIN")
          connection.exec("uptime", (err, stream) => {
            if (err) {
              reject(err)
            }
            stream
              .on("close", (code, signal) => {
                connection.end()
              })
              .on("data", (data) => {
                this.log.info("STDOUT: " + data)
              })
              .stderr.on("data", function(data) {
                this.log.error("STDERR: " + data)
              })
          })
        })
        .on("error", (err) => reject(err))
        .on("end", () => {
          this.log.info("END")
          resolve()
        })
        .on("keyboard-interactive", options.keyboardInteractive)
        .connect({
          host: options.hostname,
          port: options.port,
          username: options.username,
          password: options.password,
          agent: options.authSock,
          tryKeyboard: !!options.keyboardInteractive,
          debug: this.debug ? (detail) => this.log.info(detail) : null,
        })
    })
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

    try {
      await this.execOnHost({
        username: args.user || userInfo.username,
        hostname: args.host || "localhost",
        port: args.port ? parseInt(args.port) : 22,
        password,
        authSock: process.env["SSH_AUTH_SOCK"],
        keyboardInteractive: async (
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
    } finally {
      process.stdin.unref() // To free the Node event loop
    }

    return 0
  }
}
