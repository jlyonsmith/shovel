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
    this.stat = null
  }

  async assert(args) {
    this.args = args
    try {
      this.stat = await this.fs.lstat(args.path)
      return this.stat.isFile()
    } catch (e) {
      return false
    }
  }

  async actualize() {
    if (this.stat && this.stat.isDirectory()) {
      throw new Error(`A directory with the name as '${this.args.path}' exists`)
    }

    this.fs.ensureFile(this.args.path)
  }
}
