import childProcess from "child-process-promise"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"

/*
Ensures that a make target has been built

Example:

{
  assert: "ToolMade",
  with: {
    directory: <string>,
    target: <string>,
  }
}
*/

export class ToolMade {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { directory: directoryNode, target: targetNode } = withNode.value

    this.assertNode = assertNode

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'directory' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    this.expandedDirectory = this.expandStringNode(directoryNode)

    if (targetNode) {
      if (targetNode.type !== "string") {
        throw new ScriptError("'target' must be a string", targetNode)
      }
      this.expandedTarget = this.expandStringNode(targetNode)
    } else {
      this.expandedTarget = ""
    }

    const configFile = path.join(this.expandedDirectory, "configure")
    let pathInfo = await this.util.pathInfo(configFile)

    if (pathInfo.access[0] !== "r") {
      throw new ScriptError(`'${configFile}' not found`, directoryNode)
    }

    try {
      await this.childProcess.exec(`make -q ${this.expandedTarget}`, {
        cwd: this.expandedDirectory,
      })
    } catch (e) {
      // TODO: Research if all autotools packages return exit code > 1 for the out-of-date state
      if (e.code > 1) {
        return false
      }
    }

    return true
  }

  async rectify() {
    const command = `make ${this.expandedTarget}`

    try {
      await this.childProcess.exec(command, {
        cwd: this.expandedDirectory,
      })
    } catch (e) {
      throw new ScriptError(
        `'${command}' failed. ${e.message}`,
        this.assertNode
      )
    }
  }

  result() {
    return { directory: this.expandedDirectory, target: this.expandedTarget }
  }
}
