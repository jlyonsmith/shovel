import * as nodePty from "node-pty"
import autobind from "autobind-decorator"
import readlinePassword from "@johnls/readline-password"
import Timeout from "await-timeout"
import { ansiEscapeRegex } from "./util"

const ps1 = "PS1>"
const ps2 = "PS2>"

@autobind
export class SSH {
  constructor(container = {}) {
    this.nodePty = container.nodePty || nodePty
    this.readlinePassword = container.readlinePassword || readlinePassword
    this.Timeout = container.Timeout || Timeout
    this.process = container.process || process
    this.console = container.console || console
    this.debug = container.debug
    this.pty = null
  }

  async connect(options = {}) {
    let args = []

    if (!options.host) {
      throw new Error("Host must be specified")
    }

    this.options = Object.assign({}, options)

    if (options.user) {
      args.push(`${options.user}@${options.host}`)
    } else {
      args.push(options.host)
    }

    if (options.port) {
      args = args.concat(["-p", options.port.toString()])
    }

    if (options.identity) {
      args = args.concat(["-i", options.identity])
    }

    args = args.concat(["-o", "NumberOfPasswordPrompts=1"])

    return new Promise((resolve, reject) => {
      try {
        this.pty = this.nodePty.spawn("ssh", args, {
          name: "xterm-color",
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: process.env,
        })
      } catch (error) {
        reject(error)
      }

      this.promptDisplayed = false
      this.loginPasswordPrompts = options.loginPasswordPrompts || {}

      let promptChanged = false

      const disposable = this.pty.onData(
        this.parseLines(
          async ({ ready, permissionDenied, loginPasswordPrompt }) => {
            if (ready) {
              disposable.dispose()
              resolve()
            } else if (permissionDenied) {
              disposable.dispose()
              reject(
                new Error(
                  `Unable to connect to ${this.options.host}; bad password or key`
                )
              )
            } else if (loginPasswordPrompt) {
              if (!this.loginPasswordPrompts[loginPasswordPrompt]) {
                this.loginPasswordPrompts[loginPasswordPrompt] =
                  (await this.showPrompt(loginPasswordPrompt)) + "\n"
              }

              this.pty.write(this.loginPasswordPrompts[loginPasswordPrompt])
            } else if (!promptChanged) {
              this.pty.write(`PROMPT_COMMAND=\nPS1='${ps1}'\nPS2='${ps2}'\n`)
              promptChanged = true
            }
          }
        )
      )
      this.pty.onExit((e) => {
        if (this.promptDisplayed) {
          process.stdin.unref() // To free the Node event loop
        }

        this.loginPasswordPrompts = {}
        this.sudoPassword = undefined
        this.options = undefined
      })
    })
  }

  parseLines(cb) {
    const stripAnsiEscapes = (s) => s.replace(ansiEscapeRegex, "")

    return async (data) => {
      const outputLines = []
      const errorLines = []
      const jsonLines = []
      let exitCode = undefined
      let ready = false
      let permissionDenied = false
      let loginPasswordPrompt = undefined
      let sudoPasswordPrompt = undefined
      let lines = stripAnsiEscapes(data.toString()).match(
        /^.*((\r\n|\n|\r)|$)/gm
      )

      lines = lines.map((line) => line.trim())

      // NOTE: Keep for debugging
      //console.log(lines)

      for (const line of lines) {
        if (!line) {
          continue
        } else if (line.startsWith("error:") || line.startsWith("warning:")) {
          errorLines.push(line)
        } else if (/^\d+$/.test(line)) {
          exitCode = parseInt(line)
        } else if (/^v?\d+\.\d+\.\d+/.test(line)) {
          // Version numbers
          outputLines.push(line)
        } else if (line.startsWith("/")) {
          // Paths
          outputLines.push(line)
        } else if (line.startsWith("{")) {
          jsonLines.push(line)
        } else if (line.startsWith("[sudo] password for")) {
          sudoPasswordPrompt = line
        } else if (/^.+@.+'s password:/.test(line)) {
          loginPasswordPrompt = line
        } else if (/^.+@.+: Permission denied/.test(line)) {
          permissionDenied = true
        }
      }

      const lastLine = lines[lines.length - 1]

      if (lastLine.endsWith(ps1) || lastLine.endsWith(ps2)) {
        ready = true
      }

      await cb({
        outputLines,
        errorLines,
        jsonLines,
        exitCode,
        ready,
        permissionDenied,
        loginPasswordPrompt,
        sudoPasswordPrompt,
      })
    }
  }

  async showPrompt(prompt) {
    const rlp = this.readlinePassword.createInstance(
      this.process.stdin,
      this.process.stdout
    )

    this.promptDisplayed = true

    rlp.on("SIGINT", () => {
      this.console.log("^C")
      this.process.exit()
    })

    const response = await rlp.passwordAsync(prompt)

    rlp.close()

    return response
  }

  async run(command, options = {}) {
    if (!this.pty) {
      throw new Error("No terminal is connected")
    }

    const promises = []
    let output = []
    let exitCode = undefined

    promises.push(
      new Promise((resolve, reject) => {
        const disposable = this.pty.onData(
          this.parseLines(async (data) => {
            output = output.concat(data.outputLines)

            if (data.sudoPasswordPrompt) {
              if (!this.sudoPassword) {
                this.sudoPassword =
                  (await this.showPrompt(data.sudoPasswordPrompt)) + "\n"
              }

              this.pty.write(this.sudoPassword)
            }

            if (options.logError) {
              data.errorLines.forEach((line) => options.logError(line))
            }

            if (options.logOutput) {
              data.jsonLines.forEach((line) => options.logOutput(line))
            }

            if (data.exitCode !== undefined) {
              exitCode = data.exitCode
              disposable.dispose()
              resolve()
            }
          })
        )
      })
    )

    let timer = null

    if (options.timeout) {
      timer = new this.Timeout()
      promises.push(timer.set(options.timeout))
    }

    const commandLine =
      (options.cwd ? `cd ${options.cwd} 1> /dev/null 2> /dev/null;` : "") +
      (options.sudo ? "sudo -E " : "") +
      command +
      "; echo $?\n"

    this.pty.write(commandLine)

    try {
      await Promise.race(promises)
    } finally {
      if (timer) {
        timer.clear()
      }
    }

    // TODO: If the timer fired, Ctrl+C out of whatever we were doing?

    if (!options.noThrow && exitCode !== 0) {
      throw new Error(`Command '${command}' returned exit code ${exitCode}`)
    }

    return { exitCode, output }
  }

  close() {
    if (!this.pty) {
      throw new Error("No terminal is connected")
    }

    this.pty.destroy()
    this.pty = null
  }
}
