import fs from "fs-extra"

/*
Checks and ensures that a directory exists.

Example:

{
  assert: "DirectoryExists",
  with: {
    path: "/path/to/dir"
  }
}
*/

// TODO: Add directory ownership. Must be sudo?
// TODO: Add directory permissions.

export class DirectoryExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.makeError = container.makeError
    this.stat = null
  }

  async assert(args) {
    this.args = args

    const { path: pathNode } = args

    if (!pathNode || !pathNode.type === "string") {
      throw this.makeError("'path' must be supplied and be a string", pathNode)
    }

    try {
      this.stat = await this.fs.lstat(pathNode.value)
      return this.stat.isDirectory()
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isFile()) {
      this.makeError(
        `A file with the name as '${pathNode.value}' exists`,
        pathNode
      )
    }

    await this.fs.ensureDir(pathNode.value)
  }
}
