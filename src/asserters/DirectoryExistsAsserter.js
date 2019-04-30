import fs from "fs-extra"

/*
Example:

{
  assert: "directoryExists",
  when: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryExistsAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      const status = await this.fs.lstat(args.path)
      return true
      // return !!status?.isDirectory()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      await this.fs.mkdir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
