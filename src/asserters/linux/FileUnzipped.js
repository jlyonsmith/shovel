const fs = require("fs")
const unzip = require("unzip")

/*
Checks and ensures that a file is unzipped to a directory. If `exact` is specified,
then the directory will be made to _exactly_ match the contents of the zip file,
otherwise just the contents of the zip file will be checked.

Example:

    {
      assert: "FileUnzipped",
      with: {
        exact: <boolean>,
        zipFile: "${consulZipFile}",
        toDir: "${zipDir}",
      },
    }
*/

class FileExistsAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      // verify file at destination
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      const success = await this.unzipFile(args.zipFile, args.toDir)
      return true
    } catch (ex) {
      console.log(`Error unzipping: ${ex.message}`)
      return false
    }
  }

  async unzipFile(zipFile, toDir) {
    console.log("Start Unzip.")
    return new Promise(function(resolve, reject) {
      try {
        fs.createReadStream(zipFile).pipe(
          unzip.Extract({ path: toDir }).on("close", () => {
            console.log("Unzip completed.")
            resolve(true)
          })
        )
      } catch (ex) {
        reject(ex)
      }
    })
  }

  async fileExists(path) {
    try {
      return (await fs.lstat(path)).isFile()
    } catch (error) {
      return false
    }
  }
}

module.exports = FileExistsAsserter
