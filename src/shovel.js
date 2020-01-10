#!/usr/bin/env node
import { ShovelTool } from "./ShovelTool"
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
    this.stopSpinner()
    console.error([...arguments].join(" "))
  }

  output(line) {
    this.stopSpinner()
    if (line.startsWith("{rectified:")) {
      console.log(chalk.yellow(line))
    } else if (line.startsWith("{asserted:")) {
      console.log(chalk.green(line))
    } else {
      console.log(chalk.blueBright(line))
    }
  }

  outputError(line) {
    this.stopSpinner()
    console.log(chalk.red("remote-" + line))
  }

  warning() {
    this.stopSpinner()
    console.error(chalk.yellow("warning:", [...arguments].join(" ")))
  }

  error() {
    this.stopSpinner()
    console.error(chalk.red("error:", [...arguments].join(" ")))
  }

  enableSpinner() {
    this.spinner = this.ora({
      text: "",
      spinner: "dots",
      color: "green",
    })
  }

  startSpinner(line) {
    if (this.spinner) {
      this.spinner.start(line.startsWith("> ") ? line.substring(2) : line)
    }
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop()
    }
  }
}

const log = new Log()
const tool = new ShovelTool({
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
