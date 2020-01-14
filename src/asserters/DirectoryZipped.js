import fs from "fs-extra"
import yazl from "yazl"
import yauzl from "yauzl"
import readdirp from "readdirp"
import crypto from "crypto"
import path from "path"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class DirectoryZipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.yazl = container.yazl || yazl
    this.yauzl = container.yauzl || yauzl
    this.readdirp = container.readdirp || readdirp
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      zipFile: zipFileNode,
      directory: directoryNode,
      globs: globsNode,
    } = withNode.value

    if (!zipFileNode || zipFileNode.type !== "string") {
      throw new ScriptError(
        "'zipFile' must be supplied and be a string",
        zipFileNode || withNode
      )
    }

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'from' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    this.globs = []

    if (globsNode) {
      if (globsNode.type !== "array") {
        throw new ScriptError(
          "'globs' must be supplied and be an array",
          globsNode
        )
      }

      for (const globNode of globsNode.value) {
        if (globNode.type !== "string") {
          throw new ScriptError("glob must be a string", globNode)
        }

        this.globs.push(globNode.value)
      }
    } else {
      this.globs.push(".")
    }

    this.expandedZipFile = this.interpolator(zipFileNode)
    this.expandedDirectory = this.interpolator(directoryNode)

    if ((await this.util.pathInfo(this.expandedDirectory)).isMissing()) {
      throw new ScriptError(
        `From directory ${this.expandedDirectory} does not exist`,
        directoryNode
      )
    }

    this.files = []

    const hash = crypto.createHash("sha256")

    for await (const entry of this.readdirp(this.expandedDirectory, {
      fileFilter: this.globs,
      type: "files",
      alwaysStat: true,
      lstat: true,
    })) {
      const { path, stats } = entry

      hash.update(stats.size.toString())
      this.files.push(path)
    }

    this.digest = hash.digest("hex")

    if (!(await this.util.pathInfo(this.expandedZipFile)).isMissing()) {
      this.zipFileExists = true

      let zipFile = null
      let zipHash = crypto.createHash("sha256")

      try {
        zipFile = await this.yauzl.open(this.expandedZipFile)
        await zipFile.walkEntries(async (entry) => {
          if (!entry.fileName.endsWith("/")) {
            zipHash.update(entry.uncompressedSize.toString())
          }
        })
      } catch (e) {
        return false
      } finally {
        if (zipFile) {
          await zipFile.close()
        }
      }

      zipHash = zipHash.digest("hex")

      return this.digest === zipHash
    } else {
      this.zipFileExists = false
    }

    return false
  }

  async rectify() {
    if (this.zipFileExists) {
      await this.fs.remove(this.expandedZipFile)
    }

    const zipFile = new this.yazl.ZipFile()

    for (const file in this.files) {
      zipFile.addFile(path.join(this.expandedDirectory, file))
    }

    zipFile.end()

    await this.util.pipeToPromise(
      zipFile.outputStream,
      this.fs.createWriteStream(this.expandedZipFile)
    )
  }

  result() {
    return {
      zipFile: this.expandedZipFile,
      directory: this.expandedDirectory,
      globs: this.globs,
      files: this.files,
    }
  }
}
