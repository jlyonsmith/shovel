import fs from "fs-extra"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "FileAbsent",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
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

    this.expandedPath = this.expandStringNode(pathNode)

    let stat = null
    let ok = true

    try {
      stat = await this.fs.lstat(this.expandedPath)
      ok = false
    } catch (e) {}

    if (stat && stat.isDirectory()) {
      throw this.newScriptError(
        `Not removing existing directory with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    return ok
  }

  async rectify() {
    await this.fs.unlink(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
