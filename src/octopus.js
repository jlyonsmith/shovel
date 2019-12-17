#!/usr/bin/env node
import { OctopusTool } from "./OctopusTool"
import chalk from "chalk"
import path from "path"
import ora from "ora"
import autobind from "autobind-decorator"

@autobind
class Log {
  constructor(container = {}) {
    this.ora = container.ora || ora
  }

  info() {
    this.spinnerStop()
    console.error([...arguments].join(" "))
  }

  output(line) {
    this.spinnerStop()
    if (line.startsWith("{rectified:")) {
      console.log(chalk.yellow(line))
    } else if (line.startsWith("{asserted:")) {
      console.log(chalk.green(line))
    } else {
      console.log(line)
    }
  }

  outputError(line) {
    this.spinnerStop()
    console.log(chalk.red("remote-" + line))
  }

  warning() {
    this.spinnerStop()
    console.error(chalk.yellow("warning:", [...arguments].join(" ")))
  }

  error() {
    this.spinnerStop()
    console.error(chalk.red("error:", [...arguments].join(" ")))
  }

  initSpinner(notAnimated) {
    this.spinner = this.ora({
      text: "",
      spinner: notAnimated ? { frames: [">"], interval: 2147483647 } : "dots",
      color: "green",
    })
  }

  spinnerStart(line) {
    this.spinner.start(line)
  }

  spinnerStop() {
    if (this.spinner) {
      this.spinner.stop()
    }
  }
}

const log = new Log()
const tool = new OctopusTool({
  toolName: path.basename(process.argv[1], ".js"),
  log,
})

tool
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    process.exitCode = 200

    if (error) {
      log.error(error.message || error)

      if (tool.debug) {
        console.error(error)
      }
    }
  })
