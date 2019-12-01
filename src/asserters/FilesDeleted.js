import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "FilesDeleted",
  with: {
    paths: [
      "/path/to/file1",
      "path/to/file2"
    ]
  }
}
*/

export class FilesDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.expandStringNode = container.expandStringNode
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { paths: pathsNode } = withNode.value

    if (!pathsNode || pathsNode.type !== "array") {
      throw new ScriptError(
        "'paths' must be supplied and be an array",
        pathsNode || withNode
      )
    }

    this.unlinkedPaths = []
    this.expandedPaths = []

    let ok = true

    for (const pathNode of pathsNode.value) {
      if (pathNode.type !== "string") {
        throw new ScriptError("All 'paths' must be strings", pathNode)
      }

      const expandedPath = this.expandStringNode(pathNode)
      let stat = null

      this.expandedPaths.push(expandedPath)

      try {
        stat = await this.fs.lstat(expandedPath)
        this.unlinkedPaths.push(expandedPath)
        ok = false
      } catch (e) {}

      if (stat && stat.isDirectory()) {
        throw new ScriptError(
          `Not removing existing directory with the name '${expandedPath}'`,
          pathNode
        )
      }
    }

    return ok
  }

  async rectify() {
    for (const expandedPath of this.unlinkedPaths) {
      await this.fs.unlink(expandedPath)
    }
  }

  result(rectified) {
    return { paths: rectified ? this.unlinkedPaths : this.expandedPaths }
  }
}
