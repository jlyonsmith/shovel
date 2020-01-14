import util from "../util"
import { ScriptError } from "../ScriptError"

export class FileDeleted {
  constructor(container) {
    this.util = container.util || util
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

    const pathInfo = await this.util.pathInfo(this.expandedFile)

    if (pathInfo.isDirectory()) {
      throw new ScriptError(
        `Not removing existing directory with the name '${this.expandedFile}'`,
        fileNode
      )
    }

    return !pathInfo.isFile()
  }

  async rectify() {
    await this.fs.unlink(this.expandedFile)
  }

  result(rectified) {
    return { file: this.expandedFile }
  }
}
