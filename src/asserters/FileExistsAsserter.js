const fs = require("fs-extra")

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

class FileExistsAsserter {
  async assert(args) {
    try {
      return (await fs.lstat(args.path)).isFile()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      await fs.writeFile(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

exports.FileExistsAsserter = FileExistsAsserter
