import util from "../util"
import fs from "fs-extra"
import { ScriptError } from "../ScriptError"
import path from "path"

export class FilesDeleted {
  constructor(container) {
    this.util = container.util || util
    this.fs = container.fs || fs
    this.interpolator = container.interpolator
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

      const expandedPath = this.interpolator(fileNode)

      this.expandedFiles.push(expandedPath)

      const pathInfo = await this.util.pathInfo(expandedPath)

      if (!pathInfo.isMissing()) {
        if (!pathInfo.isFile()) {
          throw new ScriptError(
            `Not removing non-file with the name '${expandedPath}'`,
            fileNode
          )
        }

        if (
          !(await this.util.pathInfo(path.dirname(expandedPath)))
            .getAccess()
            .isWriteable()
        ) {
          throw new ScriptError(
            `Cannot write to directory of file ${expandedPath}`,
            fileNode
          )
        }

        ok = false
        this.unlinkedFiles.push(expandedPath)
      }

      // Keep going to get all files
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
