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

  static parseLines(data) {
    const stripAnsiEscapes = (s) => s.replace(ansiEscapeRegex, "")
    const outputLines = []
    const errorLines = []
    const jsonLines = []
    let startLine = undefined
    let exitCode = undefined
    let ready = false
    let permissionDenied = false
    let loginPasswordPrompt = undefined
    let sudoPasswordPrompt = undefined
    let verificationPrompt = undefined
    let lines = stripAnsiEscapes(data.toString()).match(/^.*((\r\n|\n|\r)|$)/gm)

    lines = lines.map((line) => line.trim())

    // NOTE: Keep for debugging
    // console.log(lines)

    // TODO: Support 'Enter passphrase for key...' for ssh-add (throw error)

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
      } else if (line.startsWith(">")) {
        startLine = line
      } else if (line.startsWith("{")) {
        jsonLines.push(line)
      } else if (line.startsWith("[sudo] password for")) {
        sudoPasswordPrompt = line
      } else if (/^.+@.+'s password:/.test(line)) {
        loginPasswordPrompt = line
      } else if (/^.+@.+: Permission denied/.test(line)) {
        permissionDenied = true
      } else if (line.startsWith("Verification code:")) {
        verificationPrompt = line
      }
    }

    const lastLine = lines[lines.length - 1]

    if (lastLine.endsWith(ps1) || lastLine.endsWith(ps2)) {
      ready = true
    }

    return {
      outputLines,
      errorLines,
      jsonLines,
      startLine,
      exitCode,
      ready,
      permissionDenied,
      loginPasswordPrompt,
      sudoPasswordPrompt,
      verificationPrompt,
    }
  }

  async connect(options = {}) {
    if (this.pty) {
      throw new Error("Already connected")
    }

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

      let promptChanged = false
      const dataHandler = ({
        ready,
        permissionDenied,
        loginPasswordPrompt,
        verificationPrompt,
      }) => {
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
          if (!this.loginPasswordPrompts) {
            this.loginPasswordPrompts = new Map(options.loginPasswordPrompts)
          }

          if (this.loginPasswordPrompts.has(loginPasswordPrompt)) {
            this.pty.write(this.loginPasswordPrompts.get(loginPasswordPrompt))
          } else {
            this.showPrompt(loginPasswordPrompt).then((password) => {
              this.loginPasswordPrompts.set(
                loginPasswordPrompt,
                password + "\n"
              )
              setImmediate(() => dataHandler({ loginPasswordPrompt }))
            })
          }
        } else if (verificationPrompt) {
          this.showPrompt(verificationPrompt).then((code) => {
            this.pty.write(code + "\n")
          })
        } else if (!promptChanged) {
          this.pty.write(`PROMPT_COMMAND=\nPS1='${ps1}'\nPS2='${ps2}'\n`)
          promptChanged = true
        }
      }
      const disposable = this.pty.onData((data) => {
        dataHandler(SSH.parseLines(data))
      })

      this.pty.onExit((e) => {
        if (this.promptDisplayed) {
          process.stdin.unref() // To free the Node event loop
        }

        this.loginPasswordPrompts = null
        this.sudoPassword = null
        this.sudoPassword = undefined
        this.options = undefined
      })
    })
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
    let savedExitCode = undefined

    promises.push(
      new Promise((resolve, reject) => {
        const dataHandler = ({
          exitCode,
          jsonLines,
          errorLines,
          outputLines,
          startLine,
          sudoPasswordPrompt,
        }) => {
          if (outputLines) {
            output = output.concat(outputLines)
          }

          if (sudoPasswordPrompt) {
            if (this.sudoPassword) {
              this.pty.write(this.sudoPassword)
            } else {
              this.showPrompt(sudoPasswordPrompt).then((password) => {
                this.sudoPassword = password + "\n"
                setImmediate(() => dataHandler({ sudoPasswordPrompt }))
              })
            }
          }

          if (options.logError && errorLines) {
            errorLines.forEach((line) => options.logError(line))
          }

          if (options.logOutput && jsonLines) {
            jsonLines.forEach((line) => options.logOutput(line))
          }

          if (options.logStart && startLine) {
            options.logStart(startLine)
          }

          if (exitCode !== undefined) {
            savedExitCode = exitCode
            disposable.dispose()
            resolve()
          }
        }
        const disposable = this.pty.onData((data) => {
          dataHandler(SSH.parseLines(data))
        })
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

    if (!options.noThrow && savedExitCode !== 0) {
      throw new Error(`Command '${command}' returned exit code ${exitCode}`)
    }

    return { exitCode: savedExitCode, output }
  }

  close() {
    if (!this.pty) {
      throw new Error("No terminal is connected")
    }

    this.pty.destroy()
    this.pty = null
  }
}
