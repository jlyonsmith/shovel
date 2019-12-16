import fs from "fs-extra"
import fetch from "node-fetch"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class HttpUrlDownloaded {
  constructor(container) {
    this.fs = container.fs || fs
    this.fetch = container.fetch || fetch
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { url: urlNode, digest: digestNode, file: fileNode } = withNode.value

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

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    this.expandedUrl = this.interpolator(urlNode)
    this.expandedFile = this.interpolator(fileNode)

    // TODO: Ensure we can access the download directory
    this.toFileExists = await this.util.fileExists(this.expandedFile)

    if (!this.toFileExists) {
      return false
    }

    const toFileDigest = await this.util.generateDigestFromFile(
      this.expandedFile
    )

    return toFileDigest === digestNode.value
  }

  async rectify() {
    if (this.toFileExists) {
      await this.fs.remove(this.expandedFile)
    }

    const result = await this.fetch(this.expandedUrl)
    const writeable = this.fs.createWriteStream(this.expandedFile)

    await this.util.pipeToPromise(result.body, writeable)

    // TODO: Owner and mode if provided
  }

  result() {
    // TODO: Add hash to output of actual file or the asserted hash
    return { file: this.expandedFile }
  }
}
