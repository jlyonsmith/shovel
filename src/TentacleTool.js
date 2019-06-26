import parseArgs from "minimist"
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

  async processAssertions(ssh, username, password, assertScript) {
    assertScript = this.expandAssertVariables(assertScript)
    const vars = assertScript.vars || {}
    const asserts = assertScript.assertions || []
    let scriptSuccess = true
    let an
    let description
    for (an = 0; an < asserts.length; an++) {
      const assertionSpec = asserts[an]

      const assertionName = assertionSpec.assert
      description =
        assertionSpec.description || `Step ${an + 1}: (${assertionName})`
      const runAs = assertionSpec.runAs || ""

      const args = assertionSpec.with || {}
      const argsString = JSON.stringify(args)
      const args64 = Buffer.from(argsString).toString("base64")
      const sudo = runAs == "sudo" ? "sudo" : ""
      const command = `${sudo} node doAssert.js ${assertionName} base64 ${args64}`
      const assertSuccess = await this.runAssertion(
        ssh,
        username,
        password,
        command
      )
      if (!assertSuccess) {
        scriptSuccess = false
        break
      }
    }

    if (scriptSuccess) {
      this.log.info(chalk.green(">>> Script Completed Successfully"))
    } else {
      this.log.info(
        chalk.red(`>>> Script Failed at step ${an} (${description})`)
      )
    }
  }

  async runAssertion(ssh, username, password, command) {
    const result = await ssh.execCommand(command, {
      options: { pty: !!password },
      cwd: "/opt/octopus/asserters",
      stdin: password + "\n",
    })
    const success = result.code == 0
    const response = result.stdout
    if (success) {
      this.log.info(
        chalk.green(`Assertion Success: ${success}\nResponse:\n${response}`)
      )
    } else {
      this.log.info(
        chalk.red(`Assertion Success: ${success}\nResponse:\n${response}`)
      )
    }

    return success
  }

  expandAssertVariables(assertionScript) {
    const varExpander = (tpl, args) =>
      tpl.replace(/\${(\w+)}/g, (_, v) => args[v])
    const variables = assertionScript.vars || {}
    const assertions = assertionScript.assertions || {}
    const assertionsString = JSON.stringify(assertions)
    const expanded = varExpander(assertionsString, variables)
    return { vars: variables, assertions: JSON.parse(expanded) }
  }

  getArgData(args) {
    const encoding = args[1]
    const encodedData = args[2]
    let dataString = encodedData
    if (encoding == "base64") {
      dataString = Buffer.from(encodedData, "base64").toString("ascii")
    }
    dataString = this.expandEnvVariables(dataString)
    return JSON.parse(dataString)
  }

  expandEnvVariables(dataString) {
    const varExpander = (tpl, args) =>
      tpl.replace(/{{(\w+)}}/g, (_, v) => args[v])
    return varExpander(dataString, process.env)
  }

  async getAsserterInfo(asserterName) {
    const registry = await this.getRegistry()
    return registry[asserterName]
  }

  async getAsserter(asserterName) {
    const info = await this.getAsserterInfo(asserterName)
    // console.log(`getAsserterInfo for ${asserterName} : ${JSON.stringify(info)}`)
    if (info) {
      try {
        const asserterClass = require(`./${info.module}`)
        const container = {} // pass in logger at least
        const asserter = new asserterClass(container)
        return asserter
      } catch (ex) {
        console.log(`Error creating asserter ${info.module}: ${ex.message}`)
      }
    } else {
      return null
    }
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

    // TODO: Parse the script
    // TODO: Add JSON5 source in directly and output line number information for issues
    // TODO: Run the asserters in order, calling ensure if needed
    // TODO: Ensure that errors in assert/ensure throw line number information
    // TODO: Parse variable section of script
    // TODO: Fill in variables is args
    // TODO: Test out all the asserters without mocks
    // TODO: Add a --server flag that starts an HTTP server and waits for requests

    return 0
  }
}
