import util from "../util.js"
import fs from "fs-extra"
import path from "path"
import { ScriptError } from "../ScriptError.js"

export class DirectoryDeleted {
  constructor(container) {
    this.util = container.util || util
    this.fs = container.fs || fs
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { directory: directoryNode } = withNode.value

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'directory' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    this.expandedDirectory = this.interpolator(directoryNode)

    const pathInfo = await this.util.pathInfo(this.expandedDirectory)

    if (!pathInfo.isMissing()) {
      if (!pathInfo.isDirectory()) {
        throw new ScriptError(
          `Non-directory exists with the name '${this.expandedDirectory}'`,
          directoryNode
        )
      }

      if (
        !(await this.util.pathInfo(path.dirname(this.expandedDirectory)))
          .getAccess()
          .isWriteable()
      ) {
        throw new ScriptError(
          `Parent directory of ${this.expandedDirectory} is not writable`,
          directoryNode
        )
      }

      return false
    }

    return true
  }

  async rectify() {
    await this.fs.remove(this.expandedDirectory)
  }

  result() {
    return { directory: this.expandedDirectory }
  }
}
