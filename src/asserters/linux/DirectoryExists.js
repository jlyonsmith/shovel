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

export class DirectoryExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.stat = null
  }

  async assert(args) {
    try {
      this.stat = await this.fs.lstat(args.path)
      return this.stat.isDirectory()
    } catch (e) {
      return false
    }
  }

  async actualize(args) {
    if (this.stat && this.stat.isFile()) {
      throw new Error(`A file with the name '${args.path}' exists`)
    }

    await this.fs.mkdir(args.path)
  }
}
