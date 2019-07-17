#!/usr/bin/env node
import { OctopusProxyTool } from "./OctopusProxyTool"
import chalk from "chalk"
import path from "path"
import JSON5 from "@johnls/json5"

const log = {
  info: console.error,
  asserted: function(name, result) {
    console.log(chalk.green(JSON5.stringify({ asserted: name, result })))
  },
  rectified: function(name, result) {
    console.log(chalk.yellow(JSON5.stringify({ rectified: name, result })))
  },
  error: function() {
    console.error(chalk.red("error:", [...arguments].join(" ")))
  },
  warning: function() {
    console.error(chalk.yellow("warning:", [...arguments].join(" ")))
  },
}

const tool = new OctopusProxyTool(path.basename(process.argv[1], ".js"), log)

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
