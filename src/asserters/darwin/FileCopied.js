const fs = require("fs-extra")

/*
Checks and ensures that a file or files was moved from one directory to another.

Example:
    {
      assert: "FileCopied",
      with: {
        fromPath: "${consulUnzipDir}/consul",
        toPath: "/usr/local/bin/consul",
      },
    },
*/

class FileCopied {
  async assert(args) {
    return false // always copy
  }

  async actualize(args) {
    try {
      console.log(`Copy: ${args.fromPath} => ${args.toDir}`)
      await fs.copy(args.fromPath, args.toDir)
      console.log(`copied complete `)
      return true
    } catch (error) {
      console.log(`Error copying: ${error.message}`)
      return false
    }
  }

  async fileExists(filePath) {
    try {
      return (await fs.lstat(filePath)).isFile()
    } catch (error) {
      return false
    }
  }
}

module.exports = FileCopied
