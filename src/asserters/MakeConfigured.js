import childProcess from "child-process-promise"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"

/*
Ensures that an AutoTools based package configure command has been run

Example:

{
  assert: "MakeConfigured",
  with: {
    directory: <string>,
    args: <string>,
  }
}
*/

export class MakeConfigured {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { directory: directoryNode, args: argsNode } = withNode.value

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'directory' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    this.expandedDirectory = this.expandStringNode(directoryNode)

    if (argsNode) {
      if (argsNode.type !== "string") {
        throw new ScriptError("'args' must be a string", argsNode)
      }
      this.expandedArgs = this.expandStringNode(argsNode)
    } else {
      this.expandedArgs = ""
    }

    const configFile = path.join(this.expandedDirectory, "configure")
    let pathInfo = await this.util.pathInfo(configFile)

    if (pathInfo.access[0] !== "r") {
      throw new ScriptError(`'${configFile}' not found`, directoryNode)
    }

    pathInfo = await this.util.pathInfo(
      path.join(this.expandedDirectory, "config.status")
    )

    return pathInfo.type === "f"
  }

  async rectify() {
    await this.childProcess.exec(
      `configure ${this.expandedName} ${this.expandedArgs}`,
      { cwd: this.expandedDirectory }
    )
  }

  result() {
    return { directory: this.expandedDirectory, args: this.expandedArgs }
  }
}
