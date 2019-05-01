const fs = require("fs")

class DirectoryExistsAsserter {
  constructor() {
    console.log("creating DirectoryExists")
  }

  async assert(args) {
    console.log(`DirectoryExists assert: ${JSON.stringify(args)}`)
    const path = args.directory
    const exists = await this.pathExists(path)
    return { assertion: exists, message: "Check Dir." }
  }

  async run(args) {
    console.log(`Directory Missing. Create it. run: ${JSON.stringify(args)}`)
    const path = args.directory
    let success = false
    try {
      success = await this.createDir(path)
    } catch (ex) {
      console.log(`Error creating directory: ${ex.message}`)
    }
    return { success, message: "Create dir." }
  }

  async pathExists(path) {
    return new Promise(function(resolve, reject) {
      fs.access(path, function(err) {
        if (err && err.code == "ENOENT") {
          resolve(false)
        } else {
          resolve(true)
        }
      })
    })
  }

  async createDir(path) {
    return new Promise(function(resolve, reject) {
      fs.mkdir(path, function(err) {
        if (err) {
          if (err.code == "EEXIST") {
            resolve(true)
          } else {
            reject(err)
          }
        } else {
          resolve(true)
        }
      })
    })
  }
}

module.exports = DirectoryExistsAsserter
