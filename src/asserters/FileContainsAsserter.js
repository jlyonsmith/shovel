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

export class FileContainsAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      return (await this.fs.lstat(args.path)).isFile()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      await this.fs.writeFile(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
