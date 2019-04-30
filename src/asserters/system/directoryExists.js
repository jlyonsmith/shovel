import fs from "fs-extra"

export default class DirectoryExistsAsserter {
  constructor() {}

  async assert(args) {
    return false
  }

  run(args) {
    console.log("MAKING THE DIRECTORY", args.path)
    fs.ensureDir(args.path)
      .then((result) => {
        console.log("DIRECTORY ENSURED", result)
      })
      .catch((err) => {
        console.log("ERROR ENSURING DIRECTORY", err)
      })
  }
}
