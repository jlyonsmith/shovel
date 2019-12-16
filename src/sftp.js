import * as nodePty from "node-pty"
import autobind from "autobind-decorator"
import Timeout from "await-timeout"
import readlinePassword from "@johnls/readline-password"
import { ansiEscapeRegex } from "./util"
import tempy from "tempy"
import fs from "fs-extra"

const ps1 = "sftp>"

@autobind
export class SFTP {
  constructor(container = {}) {
    this.nodePty = container.nodePty || nodePty
    this.readlinePassword = container.readlinePassword || readlinePassword
    this.Timeout = container.Timeout || Timeout
    this.process = container.process || process
    this.console = container.console || console
    this.fs = container.fs || fs
    this.debug = container.debug
    this.pty = null
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

    return new Promise((resolve, reject) => {
      try {
        this.pty = this.nodePty.spawn("sftp", args, {
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

      const dataHandler = ({
        ready,
        permissionDenied,
        loginPasswordPrompt,
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
        }
      }
      const disposable = this.pty.onData((data) => {
        dataHandler(SFTP.parseLines(data))
      })

      this.pty.onExit((e) => {
        if (this.promptDisplayed) {
          process.stdin.unref() // To free the Node event loop
        }

        this.loginPasswordPrompts = null
        this.options = undefined
        this.promptDisplayed = false
      })
    })
  }

  static parseLines(data) {
    const stripAnsiEscapes = (s) => s.replace(ansiEscapeRegex, "")
    const errorLines = []
    let ready = false
    let loginPasswordPrompt = undefined
    let lines = stripAnsiEscapes(data.toString()).match(/^.*((\r\n|\n|\r)|$)/gm)
    let permissionDenied = false

    lines = lines.map((line) => line.trim())

    // NOTE: Keep for debugging
    // console.log(lines)

    for (const line of lines) {
      if (!line) {
        continue
      } else if (line.startsWith("error:") || line.startsWith("warning:")) {
        errorLines.push(line)
      } else if (/^.+@.+'s password:/.test(line)) {
        loginPasswordPrompt = line
      } else if (/^.+@.+: Permission denied/.test(line)) {
        permissionDenied = true
      }
    }

    const lastLine = lines[lines.length - 1]

    if (lastLine.endsWith(ps1)) {
      ready = true
    }

    return {
      errorLines,
      ready,
      loginPasswordPrompt,
      permissionDenied,
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

  async putContent(remoteFile, contents, options = {}) {
    if (!this.pty) {
      throw new Error("No terminal is connected")
    }

    const localFile = tempy.file()
    const promises = []

    await this.fs.writeFile(localFile, contents)

    promises.push(
      new Promise((resolve, reject) => {
        const dataHandler = ({ errorLines, ready }) => {
          if (errorLines.length > 0) {
            if (options.logError) {
              errorLines.forEach((line) => options.logError(line))
            }
            disposable.dispose()
            reject(new Error(`Unable to upload ${remoteFile}`))
          }

          if (ready) {
            disposable.dispose()
            resolve()
          }
        }
        const disposable = this.pty.onData((data) => {
          dataHandler(SFTP.parseLines(data))
        })
      })
    )

    let timer = null

    if (options.timeout) {
      timer = new this.Timeout()
      promises.push(timer.set(options.timeout))
    }

    // TODO: Add recursive copy
    // TODO: Add copying of mode and owners

    this.pty.write(`put ${localFile} ${remoteFile}\n`)

    try {
      await Promise.race(promises)
    } finally {
      if (timer) {
        timer.clear()
      }
    }

    // TODO: If the timer fired, Ctrl+C out of whatever we were doing?
  }

  // TODO: Implement using putContent above
  async putFile(remoteFile, localFile, options = {}) {}

  close() {
    if (!this.pty) {
      throw new Error("No terminal is connected")
    }

    this.pty.destroy()
    this.pty = null
  }
}
