const fs = require("fs-extra")

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

class FileAbsent {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isFile()
    } catch (error) {
      return true
    }
  }

  async actualize(args) {
    try {
      await fs.unlink(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports.FileAbsent = FileAbsent
