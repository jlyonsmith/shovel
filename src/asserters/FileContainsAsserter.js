import fs from "fs-extra"

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

export class FileContainsAsserter {
  async assert(args) {
    try {
      // TODO : check if file contains relevant info
      return false
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
      // await fs.writeFile(args.path)
      // TODO : modify the file
      return true
    } catch (error) {
      return false
    }
  }
}
