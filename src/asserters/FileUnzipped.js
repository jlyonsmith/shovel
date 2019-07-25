import fs from "fs-extra"
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
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
  }

  async assert(args) {
    this.args = args

    const { zipPath: zipPathNode, toDirPath: toDirPathNode } = args

    if (!zipPathNode || zipPathNode.type !== "string") {
      throw this.newScriptError(
        "'zipPath' must be supplied and be a string",
        zipPathNode || this.withNode
      )
    }

    if (!toDirPathNode || toDirPathNode.type !== "string") {
      throw this.newScriptError(
        "'toDirPath' must be supplied and be a string",
        toDirPathNode || this.withNode
      )
    }

    this.expandedZipPath = this.expandStringNode(zipPathNode)
    this.expandedToDirPath = this.expandStringNode(toDirPathNode)

    if (!(await util.fileExists(this.fs, this.expandedZipPath))) {
      console.log(path.join(require("process").cwd(), this.expandedZipPath))
      throw this.newScriptError(
        `Zip file ${this.expandedZipPath} does not exist`,
        zipPathNode
      )
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
        const entryIsDir = /\/$/.test(entry.fileName)

        if (!entryIsDir && stat.isDirectory()) {
          throw new Error(
            `Existing '${targetPath}' is a directory and zip file entry is a file`
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

  async rectify() {
    let zipFile = null

    try {
      zipFile = await this.yauzl.open(this.expandedZipPath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(this.expandedToDirPath, entry.fileName)
        const targetDir = path.dirname(targetPath)
        const entryIsDir = /\/$/.test(entry.fileName)

        if (!(await util.dirExists(targetDir))) {
          this.fs.ensureDir(targetDir)
        }

        if (!entryIsDir) {
          const readable = await entry.openReadStream()
          const writeable = await this.fs.createWriteStream(targetPath)

          await util.pipeToPromise(readable, writeable)
        }
      })
    } catch (e) {
      return false
    } finally {
      if (zipFile) {
        await zipFile.close()
      }
    }
  }

  result() {
    return { zipPath: this.expandedZipPath, toDirPath: this.expandedToDirPath }
  }
}
