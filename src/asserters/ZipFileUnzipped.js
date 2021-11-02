import fs from "fs-extra"
import yauzl from "yauzl-promise"
import util from "../util.js"
import path from "path"
import { ScriptError } from "../ScriptError.js"

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

    if ((await this.util.pathInfo(this.expandedFilePath)).isMissing()) {
      throw new ScriptError(
        `Zip file ${this.expandedFilePath} does not exist`,
        fileNode
      )
    }

    if ((await this.util.pathInfo(this.expandedToPath)).isMissing()) {
      if (
        !(await this.util.pathInfo(path.dirname(this.expandedFilePath)))
          .getAccess()
          .isWriteable()
      ) {
        throw new ScriptError(
          `Parent directory of ${this.expandedFilePath} is not writeable`,
          fileNode
        )
      }

      return false
    }

    let zipFile

    try {
      zipFile = await this.yauzl.open(this.expandedFilePath)
      await zipFile.walkEntries(async (entry) => {
        const targetPath = path.join(this.expandedToPath, entry.fileName)
        const entryIsDir = entry.fileName.endsWith("/")
        const pathInfo = await this.util.pathInfo(targetPath)

        if (pathInfo.isMissing()) {
          throw new Error()
        } else if (entryIsDir && !pathInfo.isDirectory()) {
          throw new ScriptError(
            `'${targetPath}' is a non-directory; does not match zip file`,
            assertNode
          )
        } else if (!entryIsDir && !pathInfo.isFile()) {
          throw new ScriptError(
            `Existing '${targetPath}' is a directory and zip file entry is a file`,
            assertNode
          )
        } else if (!entryIsDir && entry.uncompressedSize !== pathInfo.size) {
          throw new Error()
        }
      })
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error
      }

      return false
    } finally {
      if (zipFile) {
        await zipFile.close()
      }
    }

    return true
  }

  async rectify() {
    let zipFile = await this.yauzl.open(this.expandedFilePath)

    await zipFile.walkEntries(async (entry) => {
      const targetPath = path.join(this.expandedToPath, entry.fileName)
      const entryIsDir = entry.fileName.endsWith("/")
      const targetDir = entryIsDir ? targetPath : path.dirname(targetPath)

      if (entryIsDir) {
        if ((await this.util.pathInfo(targetDir)).isMissing()) {
          await this.fs.ensureDir(targetDir)
        }
      } else {
        const readable = await entry.openReadStream()
        const writeable = await this.fs.createWriteStream(targetPath)

        await this.util.pipeToPromise(readable, writeable)
      }
    })
    await zipFile.close()
  }

  result() {
    return { file: this.expandedFilePath, toDirectory: this.expandedToPath }
  }
}
