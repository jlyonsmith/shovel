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
    this.newScriptError = container.newScriptError
    this.expandString = container.expandString
  }

  async assert(args) {
    this.args = args

    const { zipPath: zipPathNode, toDirPath: toDirPathNode } = args

    if (!zipPathNode || zipPathNode.type !== "string") {
      throw this.newScriptError(
        "'zipPath' must be supplied and be a string",
        zipPathNode
      )
    }

    if (!toDirPathNode || toDirPathNode.type !== "string") {
      throw this.newScriptError(
        "'toDirPath' must be supplied and be a string",
        toDirPathNode
      )
    }

    this.expandedZipPath = this.expandString(zipPathNode.value)
    this.expandedToDirPath = this.expandString(toDirPathNode.value)

    if (!(await util.fileExists(this.fs, this.expandedZipPath))) {
      return false
    }

    if (!(await util.dirExists(this.fs, this.expandedToDirPath))) {
      return false
    }

    let zipFile = null

    try {
      zipFile = await this.yauzl.open(this.expandedZipPath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(this.expandedToDirPath, entry.fileName)
        // This will throw if the file or directory is not present
        const stat = await this.fs.lstat(targetPath)

        if (entry.uncompressedSize !== 0 && !stat.isFile()) {
          throw new Error(
            `'${targetPath}' is a directory and zip file entry is a file`
          )
        } else if (entry.uncompressedSize !== stat.size) {
          throw new Error(
            `File size ${
              stat.size
            } of '${targetPath} does not match zip file entry of ${
              entry.uncompressedSize
            }`
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

  async actualize() {
    // TODO: Unzip the file!
  }

  result() {
    return { zipPath: this.expandedZipPath, toDirPath: this.expandedToDirPath }
  }
}
