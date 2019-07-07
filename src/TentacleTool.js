import parseArgs from "minimist"
import JSON5 from "@johnls/JSON5"
import fs from "fs-extra"
import { fullVersion } from "./version"
import autobind from "autobind-decorator"

@autobind
export class TentacleTool {
  constructor(toolName, log, options) {
    options = options || {}
    this.toolName = toolName
    this.log = log
    this.debug = options.debug
  }

  async run(argv) {
    // TODO: Add a --server flag that starts an HTTP server and waits for requests

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
Usage: ${this.toolName} [<options>] [<script-file>]

Description:

Runs an Octopus configuration script on localhost. Can take input from
the command line or through an HTTP service running on localhost.

Options:
  --help              Shows this help
  --version           Shows the tool version
`)
      return 0
    }

    const scriptFile = args._[0]

    if (!scriptFile) {
      throw new Error("Must supply an script file")
    }

    const script = JSON5.parse(await fs.readFile(scriptFile), {
      wantNodes: true,
    })

    this.processScriptFile(script)

    return 0
  }

  processScriptFile(script) {
    console.log(JSON5.stringify(script, null, "  "))
    // TODO: Parse the options
    // TODO: Parse the variables
    // TODO: Parse the asserters
    // TODO: Run the asserters in order, calling actualize if needed
    // TODO: Fill in variables in args
    // TODO: Ensure that errors in assert/actualize throw line number information
  }
}
