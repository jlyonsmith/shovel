const fs = require("fs-extra")

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

class DirectoryAbsent {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return true
    }
  }

  async actualize(args) {
    try {
      await fs.rmdir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports.DirectoryAbsent = DirectoryAbsent
