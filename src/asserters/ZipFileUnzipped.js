import fs from "fs-extra"
import yauzl from "yauzl-promise"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"

export class ZipFileUnzipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.yauzl = container.yauzl || yauzl
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { file: fileNode, toDirectory: toDirectoryNode } = withNode.value

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    if (!toDirectoryNode || toDirectoryNode.type !== "string") {
      throw new ScriptError(
        "'toDirectory' must be supplied and be a string",
        toDirectoryNode || withNode
      )
    }

    this.expandedFilePath = this.interpolator(fileNode)
    this.expandedToPath = this.interpolator(toDirectoryNode)

    if (!(await this.util.fileExists(this.expandedFilePath))) {
      throw new ScriptError(
        `Zip file ${this.expandedFilePath} does not exist`,
        fileNode
      )
    }

    if (!(await this.util.dirExists(this.expandedToPath))) {
      return false
    }

    let zipFile = null

    try {
      zipFile = await this.yauzl.open(this.expandedFilePath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(this.expandedToPath, entry.fileName)
        const entryIsDir = entry.fileName.endsWith("/")
        // This will throw if the file or directory is not present
        const stat = await this.fs.lstat(targetPath)

        if (!entryIsDir && stat.isDirectory()) {
          throw new Error(
            `Existing '${targetPath}' is a directory and zip file entry is a file`
          )
        } else if (entry.uncompressedSize !== stat.size) {
          throw new Error(
            `File size ${stat.size} of '${targetPath} does not match zip file entry of ${entry.uncompressedSize}`
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
      zipFile = await this.yauzl.open(this.expandedFilePath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(this.expandedToPath, entry.fileName)
        const entryIsDir = entry.fileName.endsWith("/")
        const targetDir = entryIsDir ? targetPath : path.dirname(targetPath)

        if (!(await this.util.dirExists(targetDir))) {
          await this.fs.ensureDir(targetDir)
        }

        if (!entryIsDir) {
          const readable = await entry.openReadStream()
          const writeable = await this.fs.createWriteStream(targetPath)

          await this.util.pipeToPromise(readable, writeable)
        }
      })
    } finally {
      if (zipFile) {
        await zipFile.close()
      }
    }
  }

  result() {
    return { file: this.expandedFilePath, toDirectory: this.expandedToPath }
  }
}
