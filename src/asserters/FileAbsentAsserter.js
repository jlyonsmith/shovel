import fs from "fs-extra"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "fileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileAbsentAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      return !(await this.fs.lstat(args.path)).isFile()
    } catch (error) {
      return true
    }
  }

  async run(args) {
    try {
      await this.fs.unlink(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
