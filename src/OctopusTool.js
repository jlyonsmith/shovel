import parseArgs from "minimist"
import { fullVersion } from "./version"
import { exec } from "child_process"
import { sync as commandExistsSync } from "command-exists"

export class OctopusTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  _ensureCommands(cmds) {
    this.cmds = this.cmds || new Set()

    cmds.forEach((cmd) => {
      if (!this.cmds.has(cmd) && !commandExistsSync(cmd)) {
        throw new Error(`Command '${cmd}' does not exist.  Please install it.`)
      } else {
        this.cmds.add(cmd)
      }
    })
  }

  _execAndCapture(command, options) {
    return new Promise((resolve, reject) => {
      const cp = exec(command, options)
      let output = ""

      cp.stdout.on("data", (data) => {
        output += data.toString()
      })

      cp.on("error", (error) => {
        reject(error)
      })

      cp.on("exit", function(code) {
        if (code !== 0) {
          reject(new Error("Non-zero exit code"))
        } else {
          resolve(output)
        }
      })
    })
  }

  _execAndLog(command, options = {}) {
    return new Promise((resolve, reject) => {
      const cp = exec(command, options)
      const re = new RegExp(/\n$/)

      cp.stdout.on("data", (data) => {
        const s = data.toString().replace(re, "")

        if (options.ansible) {
          if (s.startsWith("ok: ")) {
            this.log.ansibleOK(s)
          } else if (s.startsWith("changed: ")) {
            this.log.ansibleChanged(s)
          } else if (s.startsWith("skipping: ")) {
            this.log.ansibleSkipping(s)
          } else if (s.startsWith("error: ")) {
            this.log.ansibleError(s)
          } else {
            this.log.info(s)
          }
        } else {
          this.log.info(s)
        }
      })

      cp.stderr.on("data", (data) => {
        const s = data.toString().replace(re, "")

        if (s !== "npm" && s !== "notice" && s !== "npm notice") {
          this.log.info(s)
        }
      })

      cp.on("error", (error) => {
        reject(error)
      })

      cp.on("exit", function(code) {
        if (code !== 0) {
          reject(new Error(`'${command}' returned ${code}`))
        } else {
          resolve()
        }
      })
    })
  }

  _execAndCapture(command, options) {
    return new Promise((resolve, reject) => {
      const cp = exec(command, options)
      let output = ""

      cp.stdout.on("data", (data) => {
        output += data.toString()
      })

      cp.on("error", (error) => {
        reject(error)
      })

      cp.on("exit", function(code) {
        if (code !== 0) {
          reject(new Error(`'${command}' returned ${code}`))
        } else {
          resolve(output)
        }
      })
    })
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version"],
      string: ["host", "host-file"],
      alias: {
        h: "host",
        f: "host-file",
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
Usage: ${this.toolName} [options] <script>

Description:

Runs an Octopus configuration script on one or more hosts over SSH.

Options:
  --help        Shows this help
  --version     Shows the tool version
  --host        Host name
  --host-file   JSON5 file containing multiple host names
`)
      return 0
    }

    // TODO: Run the script

    return 0
  }
}
