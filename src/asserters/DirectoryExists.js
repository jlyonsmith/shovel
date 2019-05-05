const fs = require("fs-extra")

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

class DirectoryExists {
  async assert(args) {
    try {
      return (await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    const home = process.env.HOME
    try {
      // NOTE: probably should use ensureDir()
      await fs.mkdir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports.DirectoryExists = DirectoryExists
