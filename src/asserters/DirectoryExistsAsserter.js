import fs from "fs-extra"

/*
Checks and ensures that a directory exists.

Example:

{
  assert: "directoryExists",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryExistsAsserter {
  async assert(args) {
    try {
      return (await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      await fs.ensureDir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
