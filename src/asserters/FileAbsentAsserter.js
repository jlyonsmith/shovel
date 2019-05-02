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

export class FileAbsentAsserter {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isFile()
    } catch (error) {
      return true
    }
  }

  async run(args) {
    try {
      await fs.unlink(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}
