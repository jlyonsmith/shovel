#!/usr/bin/env node
import { OctopusTool } from "./OctopusTool"
import chalk from "chalk"
import path from "path"

const log = {
  info: function() {
    console.error([...arguments].join(" "))
  },
  output: function(line) {
    if (line.startsWith("{rectified:")) {
      console.log(chalk.yellow(line))
    } else if (line.startsWith("{asserted:")) {
      console.log(chalk.green(line))
    } else {
      console.log(line)
    }
  },
  outputError: function(line) {
    console.log(chalk.red("remote-" + line))
  },
  warning: function() {
    console.error(chalk.yellow("warning:", [...arguments].join(" ")))
  },
  error: function() {
    console.error(chalk.red("error:", [...arguments].join(" ")))
  },
}

const tool = new OctopusTool(path.basename(process.argv[1], ".js"), log)

tool
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    process.exitCode = 200

    if (error) {
      // ssh2-promise throws strings!
      log.error(error.message || error)

      if (tool.debug) {
        console.error(error)
      }
    }
  })
