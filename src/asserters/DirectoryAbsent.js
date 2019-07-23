import fs from "fs-extra"

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "DirectoryAbsent",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
    this.stats = null
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

    this.expandedPath = this.expandStringNode(pathNode)

    try {
      this.stat = await this.fs.lstat(this.expandedPath)
      return !this.stat.isDirectory()
    } catch (e) {
      return true
    }
  }

  async rectify() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isFile()) {
      throw this.newScriptError(
        `Not removing existing file with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    await this.fs.remove(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
