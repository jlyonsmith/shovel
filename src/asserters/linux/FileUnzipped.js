import fs from "fs"
import yauzl from "yauzl-promise"
import * as util from "./util"
import path from "path"

/*
Checks and ensures that a .zip file is unzipped to a directory.

Example:

    {
      assert: "FileUnzipped",
      with: {
        zipPath: "${consulZipPath}",
        toDirPath: "./xyz",
      },
    }
*/

export class FileUnzipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.yauzl = container.yauzl || yauzl
  }

  async assert(args) {
    this.args = args

    if (!args.hasOwnProperty("zipPath")) {
      throw new Error("Must specify 'zipPath'")
    }

    if (!args.hasOwnProperty("toDirPath")) {
      throw new Error("Must specify 'toDirPath'")
    }

    if (!(await util.fileExists(this.fs, args.zipPath))) {
      return false
    }

    if (!(await util.dirExists(this.fs, args.toDirPath))) {
      return false
    }

    let zipFile = null

    // yauzl.open("scratch.zip").then((zf)=>{ zf.walkEntries((entry)=>{console.log(entry)}).then(() => zf.close())})

    try {
      zipFile = await this.yauzl.open(args.zipPath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(args.toDirPath, entry.fileName)
        // This will throw if the file or directory is not present
        const stat = await this.fs.lstat(targetPath)

        if (entry.uncompressedSize !== 0 && !stat.isFile()) {
          throw new Error(
            `'${targetPath}' is a directory and zip file entry is a file`
          )
        } else if (entry.uncompressedSize !== stat.size) {
          throw new Error(
            `File size of '${targetPath} does not match zip file entry`
          )
        }
      })
    } catch (e) {
      return false
    } finally {
      if (zipFile) {
        await zipFile.close()
      }
    }

    return true
  }

  async actualize() {}
}
