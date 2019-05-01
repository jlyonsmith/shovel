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

class DirectoryExistsAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      return (await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      await fs.mkdir(args.path)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = DirectoryExistsAsserter
