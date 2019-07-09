import fs from "fs-extra"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "fileAbsent",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.stat = null
  }

  async assert(args) {
    this.args = args

    const { path: pathNode } = args

    if (!pathNode || pathNode.type !== "string") {
      throw this.newScriptError(
        "'path' must be supplied and be a string",
        pathNode
      )
    }

    try {
      this.stat = await this.fs.lstat(pathNode.value)
      return !this.stat.isFile()
    } catch (e) {
      return true
    }
  }

  async actualize() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isDirectory()) {
      throw this.newScriptError(
        `Not removing existing directory with the name '${pathNode.value}'`,
        pathNode
      )
    }

    await this.fs.unlink(pathNode.value)
  }
}
