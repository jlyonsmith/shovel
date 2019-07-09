import fs from "fs-extra"

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
      return this.stat.isFile()
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isDirectory()) {
      throw this.newScriptError(
        `A directory with the name as '${pathNode.value}' exists`,
        pathNode
      )
    }

    this.fs.ensureFile(pathNode.value)
  }
}
