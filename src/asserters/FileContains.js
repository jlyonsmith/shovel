const fs = require("fs-extra")

/*
Checks and ensures that a file contains some specific data.

Example:

{
  assert: "fileContains",
  with: {
    data: "dataToCheck"
  }
}
*/

class FileContains {
  async assert(args) {
    try {
      // TODO : check if file contains relevant info
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // await fs.writeFile(args.path)
      // TODO : modify the file
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = FileContains
