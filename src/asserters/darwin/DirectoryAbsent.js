const fs = require("fs-extra")

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "directoryAbsent",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryAbsent {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return true
    }
  }

  async actualize(args) {
    try {
      await fs.remove(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports.DirectoryAbsent = DirectoryAbsent
