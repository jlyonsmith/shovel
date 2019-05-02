const fs = require("fs-extra")

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

class FileAbsentAsserter {
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

exports.FileAbsentAsserter = FileAbsentAsserter
