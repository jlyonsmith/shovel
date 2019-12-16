import childProcess from "child-process-es6-promise"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"

export class AutoToolProjectConfigured {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.interpolator = container.interpolator
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

    this.expandedDirectory = this.interpolator(directoryNode)

    if (argsNode) {
      if (argsNode.type !== "string") {
        throw new ScriptError("'args' must be a string", argsNode)
      }
      this.expandedArgs = this.interpolator(argsNode)
    } else {
      this.expandedArgs = ""
    }

    const configFile = path.join(this.expandedDirectory, "configure")
    let pathInfo = await this.util.pathInfo(configFile)

    if (!pathInfo.getAccess().isReadable()) {
      throw new ScriptError(`'${configFile}' not found`, directoryNode)
    }

    pathInfo = await this.util.pathInfo(
      path.join(this.expandedDirectory, "config.status")
    )

    return pathInfo.isFile()
  }

  async rectify() {
    const cwd = path.resolve(this.expandedDirectory)

    await this.childProcess.exec(`./configure ${this.expandedArgs}`, {
      cwd,
    })
  }

  result() {
    return { directory: this.expandedDirectory, args: this.expandedArgs }
  }
}
