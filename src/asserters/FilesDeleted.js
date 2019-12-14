import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

export class FilesDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.interpolateNode = container.interpolateNode
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { files: filesNode } = withNode.value

    if (!filesNode || filesNode.type !== "array") {
      throw new ScriptError(
        "'files' must be supplied and be an array",
        filesNode || withNode
      )
    }

    this.unlinkedFiles = []
    this.expandedFiles = []

    let ok = true

    for (const fileNode of filesNode.value) {
      if (fileNode.type !== "string") {
        throw new ScriptError("All 'files' must be strings", fileNode)
      }

      const expandedPath = this.interpolateNode(fileNode)
      let stat = null

      this.expandedFiles.push(expandedPath)

      try {
        stat = await this.fs.lstat(expandedPath)
        this.unlinkedFiles.push(expandedPath)
        ok = false
      } catch (e) {}

      if (stat && stat.isDirectory()) {
        throw new ScriptError(
          `Not removing existing directory with the name '${expandedPath}'`,
          fileNode
        )
      }
    }

    return ok
  }

  async rectify() {
    for (const expandedPath of this.unlinkedFiles) {
      await this.fs.unlink(expandedPath)
    }
  }

  result(rectified) {
    return { files: rectified ? this.unlinkedFiles : this.expandedFiles }
  }
}
