import fs from "fs-extra"

/*
Example:

{
  assert: "fileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileExistsAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      const status = await this.fs.lstat(args.path)
      return true
      // return !!status?.isFile()
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
