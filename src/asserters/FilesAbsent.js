import fs from "fs-extra"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "FilesAbsent",
  with: {
    paths: [
      "/path/to/file1",
      "path/to/file2"
    ]
  }
}
*/

export class FilesAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
    this.stat = null
  }

  async assert(args) {
    this.args = args

    const { paths: pathsNode } = args

    if (!pathsNode || pathsNode.type !== "array") {
      throw this.newScriptError(
        "'paths' must be supplied and be an array",
        pathsNode || this.withNode
      )
    }

    this.expandedPaths = []

    let ok = true

    for (const pathNode of pathsNode.value) {
      if (pathNode.type !== "string") {
        throw this.newScriptError("All 'paths' must be strings", pathNode)
      }

      const expandedPath = this.expandStringNode(pathNode)

      this.expandedPaths.push(expandedPath)

      let stat = null

      try {
        stat = await this.fs.lstat(expandedPath)
        ok = false
      } catch (e) {}

      if (stat && stat.isDirectory()) {
        throw this.newScriptError(
          `Not removing existing directory with the name '${expandedPath}'`,
          pathNode
        )
      }
    }

    return ok
  }

  async rectify() {
    for (const expandedPath of this.expandedPaths) {
      await this.fs.unlink(expandedPath)
    }
  }

  result() {
    return { paths: this.expandedPaths }
  }
}
