import parseArgs from "minimist"
import JSON5 from "@johnls/JSON5"
import fs from "fs-extra"
import { fullVersion } from "./version"
import autobind from "autobind-decorator"
import * as asserters from "./asserters"

class ScriptError extends Error {
  constructor(message, fileName, node) {
    const lineNumber = node.line
    const columnNumber = node.column

    super(message, fileName, lineNumber, columnNumber)
    this.message = `(${fileName}:${lineNumber}:${columnNumber}) ${message}`
  }
}

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
      boolean: ["verbose", "help", "version", "debug"],
      string: [],
      alias: {
        v: "verbose",
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
Usage: ${this.toolName} [<options>] [<script-file>]

Description:

Runs an Octopus configuration script on localhost. Can take input from
the command line or through an HTTP service running on localhost.

Options:
  --verbose           Give verbose output
  --help              Shows this help
  --version           Shows the tool version
`)
      return 0
    }

    const scriptFileName = args._[0]

    if (!scriptFileName) {
      throw new Error("Must supply an script file")
    }

    const scriptNodes = JSON5.parse(await fs.readFile(scriptFileName), {
      wantNodes: true,
    })

    this.processScriptFile(scriptFileName, scriptNodes, args.verbose)

    return 0
  }

  async processScriptFile(scriptFileName, scriptNodes, verbose) {
    if (scriptNodes.type !== "object") {
      throw new ScriptError(
        "Script must have an object as the root",
        scriptFileName,
        scriptNodes
      )
    }

    // This is the execution context that holds execution state
    const context = {
      vars: { ...process.env },
    }

    const {
      options: optionsNode,
      variables: varsNode,
      assertions: assertionsNode,
    } = scriptNodes.value

    if (optionsNode) {
      if (optionsNode.type !== "object") {
        throw new ScriptError(
          "'options' must be an object",
          scriptFileName,
          optionsNode
        )
      }

      const { description: descriptionNode } = optionsNode.value

      if (descriptionNode) {
        if (descriptionNode.type !== "string") {
          throw new ScriptError(
            "'options.description' must be a string",
            scriptFileName,
            descriptionNode
          )
        }

        context.description = descriptionNode.value
        this.log.info(`${context.description}`)
      }
    }

    if (varsNode) {
      if (varsNode.type !== "object") {
        throw new ScriptError(
          "'variables' must be an object",
          scriptFileName,
          varsNode
        )
      }

      for (const [key, value] of Object.entries(varsNode.value)) {
        switch (value.type) {
          case "null":
            delete context.vars[key]
            break
          case "numeric":
          case "boolean":
            context.vars[key] = value.value.toString()
            break
          case "string":
            context.vars[key] = value.value
            break
          default:
            throw new ScriptError(
              `Variable of type ${value.type} is invalid`,
              scriptFileName,
              value
            )
        }
      }
    }

    if (verbose) {
      this.log.info(JSON5.stringify(context.vars, null, "  "))
    }

    if (!assertionsNode) {
      this.log.warn("No 'assertions' found")
      return
    }

    if (assertionsNode.type !== "array") {
      throw new ScriptError(
        "'assertions' must be an array",
        scriptFileName,
        assertionsNode
      )
    }

    context.assertions = []

    for (const assertionNode of assertionsNode.value) {
      if (assertionNode.type !== "object") {
        throw new ScriptError(
          "Assertion must be an object",
          scriptFileName,
          assertionNode
        )
      }

      const assertion = {}
      const {
        description: descriptionNode,
        assert: assertNode,
        with: withNode,
      } = assertionNode.value

      if (assertNode) {
        if (assertNode.type !== "string") {
          throw new ScriptError(
            "Assertion 'assert' must be a string",
            scriptFileName,
            assertNode
          )
        }
        assertion.name = assertNode.value
      } else {
        throw new ScriptError(
          "Assertion has no 'assert' value",
          scriptFileName,
          assertNode
        )
      }

      if (descriptionNode) {
        if (descriptionNode.type !== "string") {
          throw new ScriptError(
            "Assertion 'description' must be a string",
            scriptFileName,
            descriptionNode
          )
        }
        assertion.description = descriptionNode.value
      }

      if (withNode) {
        if (withNode.type !== "object") {
          throw new ScriptError(
            "Assertion 'with' must be an object",
            scriptFileName,
            withNode
          )
        }

        assertion.args = withNode.value
      }

      context.assertions.push(assertion)
    }

    for (const assertion of context.assertions) {
      const asserter = new asserters[assertion.name]({
        makeError: (message, node) => {
          return new ScriptError(message, scriptFileName, node)
        },
      })
      let ok = false

      try {
        ok = await asserter.assert(assertion.args)
      } catch (e) {
        throw e
      }

      if (!ok) {
        try {
          await asserter.actualize()
        } catch (e) {
          throw e
        }
        this.log.info(`Actualized '${assertion.name}'`)
      } else {
        this.log.info(`Asserted '${assertion.name}'`)
      }
    }
  }
}
