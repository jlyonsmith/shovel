import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import * as util from "./util"

/*
Asserts that a file is downloaded. Uses SHA256 digest to verify proper file.

Example:

{
  assert: "FileDownloaded",
  with: {
        url: "https://sourcehost.com/linux_amd64.zip",
        digest: "658f4f3b305cd357a9501728b8a1dc5f...",
        toPath: "${destZipFile}",
  }
}
*/

export class FileDownloaded {
  constructor(container) {
    this.fs = container.fs || fs
    this.fetch = container.fetch || fetch
    this.newScriptError = container.newScriptError
  }

  async assert(args) {
    this.args = args

    const { url: urlNode, digest: digestNode, toPath: toPathNode } = args

    if (!urlNode || urlNode.type !== "string") {
      throw this.newScriptError(
        "'fromPath' must be supplied and be a string",
        urlNode
      )
    }

    if (!digestNode || digestNode.type !== "string") {
      throw this.newScriptError(
        "'digest' must be supplied and be a string containing the SHA256 hash of the string in hexadecimal",
        digestNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw this.newScriptError(
        "'toPath' must be supplied and be a string",
        toPathNode
      )
    }

    try {
      this.toFileExists = await util.fileExists(this.fs, toPathNode.value)

      if (!this.toFileExists) {
        return false
      }

      const toFileDigest = await util.generateDigestFromFile(
        this.fs,
        toPathNode.value
      )

      return toFileDigest === digestNode.value
    } catch (error) {
      return false
    }
  }

  async actualize() {
    const { url: urlNode, toPath: toPathNode } = this.args

    if (!this.toFileExists) {
      {
        const toDirPath = path.dirname(toPathNode.value)

        if (!(await util.dirExists(this.fs, toDirPath))) {
          await this.fs.ensureDir(toDirPath)
        }
      }
    } else {
      await this.fs.remove(toPathNode.value)
    }

    const result = await this.fetch(urlNode.value)
    const writeable = this.fs.createWriteStream(toPathNode.value)

    await util.pipeToPromise(result.body, writeable)
  }
}
