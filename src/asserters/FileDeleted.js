import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

export class FileDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.interpolator = container.interpolator
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { file: fileNode } = withNode.value

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    this.expandedFile = this.interpolator(fileNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedFile)
    } catch (e) {
      return true
    }

    if (stat && stat.isDirectory()) {
      throw new ScriptError(
        `Not removing existing directory with the name '${this.expandedFile}'`,
        fileNode
      )
    }

    return false
  }

  async rectify() {
    await this.fs.unlink(this.expandedFile)
  }

  result(rectified) {
    return { file: this.expandedFile }
  }
}
