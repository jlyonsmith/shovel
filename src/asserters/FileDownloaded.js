import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

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
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      url: urlNode,
      digest: digestNode,
      toPath: toPathNode,
    } = withNode.value

    if (!urlNode || urlNode.type !== "string") {
      throw new ScriptError(
        "'fromPath' must be supplied and be a string",
        urlNode || withNode
      )
    }

    if (!digestNode || digestNode.type !== "string") {
      throw new ScriptError(
        "'digest' must be supplied and be a string containing the SHA256 hash of the string in hexadecimal",
        digestNode || withNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw new ScriptError(
        "'toPath' must be supplied and be a string",
        toPathNode || withNode
      )
    }

    this.expandedUrl = this.expandStringNode(urlNode)
    this.expandedToPath = this.expandStringNode(toPathNode)
    this.toFileExists = await util.fileExists(this.fs, this.expandedToPath)

    if (!this.toFileExists) {
      return false
    }

    // Ensure we can access the download directory
    try {
      await this.fs.access(
        path.dirname(this.expandedToPath),
        fs.constants.W_OK | fs.constants.R_OK
      )
    } catch (e) {
      throw new ScriptError(e.message, toPathNode)
    }

    const toFileDigest = await util.generateDigestFromFile(
      this.fs,
      this.expandedToPath
    )

    return toFileDigest === digestNode.value
  }

  async rectify() {
    if (this.toFileExists) {
      await this.fs.remove(this.expandedToPath)
    }

    const result = await this.fetch(this.expandedUrl)
    const writeable = this.fs.createWriteStream(this.expandedToPath)

    await this.util.pipeToPromise(result.body, writeable)

    // TODO: Owner and mode if provided
  }

  result() {
    // TODO: Add hash to output of actual file or the asserted hash
    return { toPath: this.expandedToPath }
  }
}
