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
      console.log(` assert is dir: ${args.path}`)
      return (await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      console.log(`assert failed`)
      return false
    }
  }

  async actualize(args) {
    const home = process.env.HOME
    console.log(`Home: "${home}"`)
    try {
      console.log(`mkdir ${args.path}`)
      // NOTE: probably should use ensureDir()
      await fs.mkdir(args.path)
      return true
    } catch (error) {
      console.log(`Error creating dir: ${JSON.stringify(error)}`)
      return false
    }
  }
}

module.exports.DirectoryExists = DirectoryExists
