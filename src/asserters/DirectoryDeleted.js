import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

export class DirectoryDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.interpolateNode = container.interpolateNode
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

    this.expandedDirectory = this.interpolateNode(directoryNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedDirectory)
    } catch (e) {
      return true
    }

    if (stat && stat.isFile()) {
      throw new ScriptError(
        `File exists with the name '${this.expandedDirectory}'`,
        directoryNode
      )
    }

    return false
  }

  async rectify() {
    await this.fs.remove(this.expandedDirectory)
  }

  result() {
    return { directory: this.expandedDirectory }
  }
}
