#!/usr/bin/env node
import { OctopusTool } from "./OctopusTool"
import chalk from "chalk"
import path from "path"

const log = {
  info: function() {
    console.error([...arguments].join(" "))
  },
  asserted: function() {
    console.log(chalk.green(...arguments))
  },
  rectified: function(name, result) {
    console.log(chalk.yellow(...arguments))
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
