import fs from "fs-extra"
import JSON5 from "@johnls/json5"

/*
Checks and ensures that a file exists.

Example:

{
  assert: "fileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandString = container.expandString
    this.withNode = container.withNode
    this.stat = null
  }

  async assert(args) {
    this.args = args

    const { path: pathNode } = args

    if (!pathNode || pathNode.type !== "string") {
      throw this.newScriptError(
        "'path' must be supplied and be a string",
        pathNode || this.withNode
      )
    }

    this.expandedPath = this.expandString(pathNode.value)

    try {
      this.stat = await this.fs.lstat(this.expandedPath)
      return this.stat.isFile()
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isDirectory()) {
      throw this.newScriptError(
        `A directory with the name as '${this.expandedPath}' exists`,
        pathNode
      )
    }

    this.fs.ensureFile(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
