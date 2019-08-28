import fs from "fs-extra"
import JSON5 from "@johnls/json5"

/*
Checks and ensures that a file exists.

Example:

{
  assert: "FileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.expandStringNode = container.expandStringNode
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with

    const { path: pathNode } = withNode.value

    if (!pathNode || pathNode.type !== "string") {
      throw new ScriptError(
        "'path' must be supplied and be a string",
        pathNode || withNode
      )
    }

    this.expandedPath = this.expandStringNode(pathNode)

    try {
      this.stat = await this.fs.lstat(this.expandedPath)
      return this.stat.isFile()
    } catch (e) {
      return false
    }
  }

  async rectify() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isDirectory()) {
      throw new ScriptError(
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
