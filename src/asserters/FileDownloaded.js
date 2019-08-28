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
