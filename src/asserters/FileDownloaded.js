import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import * as util from "../util"

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
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
  }

  async assert(args) {
    this.args = args

    const { url: urlNode, digest: digestNode, toPath: toPathNode } = args

    if (!urlNode || urlNode.type !== "string") {
      throw this.newScriptError(
        "'fromPath' must be supplied and be a string",
        urlNode || this.withNode
      )
    }

    if (!digestNode || digestNode.type !== "string") {
      throw this.newScriptError(
        "'digest' must be supplied and be a string containing the SHA256 hash of the string in hexadecimal",
        digestNode || this.withNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw this.newScriptError(
        "'toPath' must be supplied and be a string",
        toPathNode || this.withNode
      )
    }

    this.expandedUrl = this.expandStringNode(urlNode)
    this.expandedToPath = this.expandStringNode(toPathNode)
    this.toFileExists = await util.fileExists(this.fs, this.expandedToPath)

    if (!this.toFileExists) {
      return false
    }

    const toFileDigest = await util.generateDigestFromFile(
      this.fs,
      this.expandedToPath
    )

    return toFileDigest === digestNode.value
  }

  async rectify() {
    // TODO: Ensure this works when the file cannot be removed
    if (this.toFileExists) {
      await this.fs.remove(this.expandedToPath)
    }

    const toDirPath = path.dirname(this.expandedToPath)

    if (!(await util.dirExists(fs, toDirPath))) {
      await this.fs.ensureDir(toDirPath)
    }

    const result = await this.fetch(this.expandedUrl)
    const writeable = this.fs.createWriteStream(this.expandedToPath)

    await util.pipeToPromise(result.body, writeable)
  }

  result() {
    return { toPath: this.expandedToPath }
  }
}
