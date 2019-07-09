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
    this.stats = null
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
      return !this.stat.isDirectory()
    } catch (e) {
      return true
    }
  }

  async actualize() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isFile()) {
      throw this.newScriptError(
        `Not removing existing file with the name '${pathNode.value}'`,
        pathNode
      )
    }

    await this.fs.remove(pathNode.value)
  }
}
