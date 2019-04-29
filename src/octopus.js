#!/usr/bin/env node
import { OctopusTool } from "./OctopusTool"
import chalk from "chalk"
import path from "path"

const log = {
  info: console.log,
  confirm: function() {
    console.error(chalk.green([...arguments].join(" ")))
  },
  error: function() {
    console.error(chalk.red("error:", [...arguments].join(" ")))
  },
  warning: function() {
    console.error(chalk.yellow("warning:", [...arguments].join(" ")))
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
      log.error(error.message)
      if (tool.debug) {
        console.error(error)
      }
    }
  })
