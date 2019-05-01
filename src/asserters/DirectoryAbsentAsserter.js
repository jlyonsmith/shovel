import fs from "fs-extra"

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "directoryExists",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryAbsentAsserter {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return true
    }
  }

  async run(args) {
    try {
      await fs.rmdir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
