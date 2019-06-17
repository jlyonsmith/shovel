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
    try {
      this.stat = await this.fs.lstat(args.path))
    } catch (error) {
      return true
    }
  }

  async actualize(args) {
    await fs.unlink(args.path)
  }
}
