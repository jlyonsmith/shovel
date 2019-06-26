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
    this.stat = null
  }

  async assert(args) {
    this.args = args

    try {
      this.stat = await this.fs.lstat(args.path)
      return !this.stat.isFile()
    } catch (e) {
      return true
    }
  }

  async actualize() {
    if (this.stat && this.stat.isDirectory()) {
      throw new Error(
        `Not removing existing directory with the name '${this.args.path}'`
      )
    }

    await this.fs.unlink(this.args.path)
  }
}
