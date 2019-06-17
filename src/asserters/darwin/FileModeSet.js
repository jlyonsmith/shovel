const fs = require("fs-extra")

/*
Checks and ensures that a file mode set.

Example:

{
  assert: "FileModeSet",
  with: {
    path: "/path/to/file"
    mode: "+x"
  }
}
*/

class FileModeSet {
  async assert(args) {
    return false
  }

  async actualize(args) {
    try {
      await fs.chmod(args.path, args.mode)
      console.log(`Mode changed: ${args.path}: ${args.mode}`)
      return true
    } catch (ex) {
      console.log(`Error changing mode: ${ex.message}`)
      return false
    }
  }
}

module.exports = FileModeSet
