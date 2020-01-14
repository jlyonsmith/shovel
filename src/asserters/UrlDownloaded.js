import fs from "fs-extra"
import os from "os"
import path from "path"
import fetch from "node-fetch"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class UrlDownloaded {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.fetch = container.fetch || fetch
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      url: urlNode,
      digest: digestNode,
      file: fileNode,
      owner: ownerNode,
      mode: modeNode,
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

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    const userInfo = this.os.userInfo()
    const users = await this.util.getUsers(this.fs)
    const groups = await this.util.getGroups(this.fs)

    this.owner = Object.assign(
      { uid: userInfo.uid, gid: userInfo.gid },
      this.util.parseOwnerNode(ownerNode, users, groups)
    )
    this.mode = this.util.parseModeNode(modeNode, 0o777)
    this.expandedUrl = this.interpolator(urlNode)
    this.expandedFile = this.interpolator(fileNode)

    if ((this.owner.uid !== userInfo.uid || this.owner.gid !== userInfo.gid) && userInfo.uid !== 0) {
      throw new ScriptError(`Cannot set owner and group if not running as root`, ownerNode)
    }

    if ((await this.util.pathInfo(this.expandedFile)).isMissing()) {
      return false
    }

    const toDir = path.dirname(this.expandedFile)
    const access = (await this.util.pathInfo(toDir)).getAccess()

    if (!access.isWriteable()) {
      throw new ScriptError(`Cannot write to directory '${toDir}'`, fileNode)
    }

    this.toFileDigest = await this.util.generateDigestFromFile(
      this.expandedFile
    )

    return this.toFileDigest === digestNode.value
  }

  async rectify() {
    const result = await this.fetch(this.expandedUrl)
    const writeable = this.fs.createWriteStream(this.expandedFile)

    await this.util.pipeToPromise(result.body, writeable)
    await this.fs.chown(this.expandedFile, this.owner.uid, this.owner.gid)
  }

  result() {
    return {
      url: this.expandedUrl,
      digest: this.toFileDigest,
      file: this.expandedFile,
    }
  }
}
