import parseArgs from "minimist"
import JSON5 from "@johnls/JSON5"
import fs from "fs-extra"
import vm from "vm"
import { fullVersion } from "./version"
import autobind from "autobind-decorator"
import * as asserters from "./asserters"

@autobind
export class OctopusProxyTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  async run(argv) {
    const options = {
      boolean: ["help", "version", "debug"],
      string: [],
      alias: {},
    }
    const args = parseArgs(argv, options)

    this.debug = args.debug

    if (args.version) {
      this.log.info(`${fullVersion}`)
      return 0
    }

    if (args.help) {
      this.log.info(`
Usage: ${this.toolName} [<options>]

Description:

Runs an HTTP service that can receive and run an Octopus script.

Options:
  --help              Shows this help
  --version           Shows the tool version
  --port,-p           Port on which to run the service. Default is 9000
`)

      // TODO: Create an Express based HTTP server on localhost
      // TODO: Run a script endpoint
      // TODO: Receive script
      // TODO: Invoke Octopus object to run script
      // TODO: Stream response back to client
      // TODO: Exit endpoint
      return 0
    }
  }
}
