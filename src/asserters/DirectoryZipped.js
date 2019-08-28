import fs from "fs-extra"
import yazl from "yazl"
import yauzl from "yauzl"
import readdirp from "readdirp"
import crypto from "crypto"
import path from "path"
import * as util from "../util"

/*
Checks and ensures that one or more files are in .zip file

Example:

    {
      assert: "DirectoryZipped",
      with: {
        zip: <string>,
        from: <string>,
        globs: <array>,
      },
    }
*/

export class DirectoryZipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.yazl = container.yazl || yazl
    this.yauzl = container.yauzl || yauzl
    this.readdirp = container.readdirp || readdirp
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      zip: zipPathNode,
      from: fromPathNode,
      globs: globsNode,
    } = withNode.value

    if (!zipPathNode || zipPathNode.type !== "string") {
      throw new ScriptError(
        "'zip' must be supplied and be a string",
        zipPathNode || withNode
      )
    }

    if (!fromPathNode || zipPathNode.type !== "string") {
      throw new ScriptError(
        "'from' must be supplied and be a string",
        fromPathNode || withNode
      )
    }

    this.globs = []

    if (globsNode) {
      if (globsNode.type !== "array") {
        throw new ScriptError(
          "'globs' must be supplied and be an array",
          globsNode || withNode
        )
      }

      for (const globNode of globsNode.value) {
        if (globNode.type !== "string") {
          throw new ScriptError("glob must be a string", globNode)
        }

        try {
          this.globs.push(globNode.value)
        } catch (e) {
          throw new ScriptError(
            `Glob '${globNode.value}' could not be parsed`,
            globNode
          )
        }
      }
    } else {
      this.globs.push(".")
    }

    this.expandedZipPath = this.expandStringNode(zipPathNode)
    this.expandedFromPath = this.expandStringNode(fromPathNode)

    if (!(await this.util.dirExists(this.fs, this.expandedFromPath))) {
      throw new ScriptError(
        `From directory ${this.expandedFromPath} does not exist`,
        globsNode
      )
    }

    this.files = []

    const hash = crypto.createHash("sha256")

    for await (const entry of this.readdirp(this.expandedFromPath, {
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

    if (await this.util.fileExists(this.fs, this.expandedZipPath)) {
      this.zipFileExists = true

      let zipFile = null
      let zipHash = crypto.createHash("sha256")

      try {
        zipFile = await this.yauzl.open(this.expandedZipPath)
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

      return this.digest === zipHash.digest("hex")
    } else {
      this.zipFileExists = false
    }

    return false
  }

  async rectify() {
    if (this.zipFileExists) {
      await this.fs.remove(this.expandedZipPath)
    }

    let zipFile = null

    zipFile = new this.yazl.ZipFile()

    for (const file in this.files) {
      zipFile.addFile(path.join(this.expandedFromPath, file))
    }

    zipFile.end()

    await this.util.pipeToPromise(
      zipFile.outputStream,
      this.fs.createWriteStream(this.expandedZipPath)
    )
  }

  result() {
    return {
      zip: this.expandedZipPath,
      from: this.expandedFromPath,
      globs: this.globs,
      files: this.files,
    }
  }
}
