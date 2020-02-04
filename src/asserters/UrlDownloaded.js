import fs from "fs-extra"
import os from "os"
import path from "path"
import fetch from "node-fetch"
import vm from "vm"
import util from "../util"
import HttpsProxyAgent from "https-proxy-agent"
import HttpProxyAgent from "http-proxy-agent"
import { ScriptError } from "../ScriptError"

export class UrlDownloaded {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.fetch = container.fetch || fetch
    this.util = container.util || util
    this.vm = container.vm || vm
    this.HttpProxyAgent = container.util || HttpProxyAgent
    this.HttpsProxyAgent = container.util || HttpsProxyAgent
    this.interpolator = container.interpolator
    this.runContext = container.runContext
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

    if (
      (this.owner.uid !== userInfo.uid || this.owner.gid !== userInfo.gid) &&
      userInfo.uid !== 0
    ) {
      throw new ScriptError(
        `Cannot set owner and group if not running as root`,
        ownerNode
      )
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
    // TODO: Support http_proxy/https_proxy environment variables set in vars. https://github.com/node-fetch/node-fetch/issues/79#issuecomment-184594701
    const httpProxyUrl = this.vm.runInContext("env.http_proxy", this.runContext)
    const httpsProxyUrl = this.vm.runInContext(
      "env.https_proxy",
      this.runContext
    )
    let agent = null

    if (this.expandedUrl.startsWith("http:") && httpProxyUrl) {
      agent = new this.HttpProxyAgent(httpProxyUrl)
      this.proxy = httpProxyUrl
    } else if (this.expandedUrl.startsWith("https:") && httpsProxyUrl) {
      agent = new this.HttpsProxyAgent(httpsProxyUrl)
      this.proxy = httpsProxyUrl
    }

    const result = await this.fetch(this.expandedUrl, agent)
    const writeable = this.fs.createWriteStream(this.expandedFile)

    await this.util.pipeToPromise(result.body, writeable)
    await this.fs.chown(this.expandedFile, this.owner.uid, this.owner.gid)
  }

  result() {
    const obj = {
      url: this.expandedUrl,
      digest: this.toFileDigest,
      file: this.expandedFile,
    }

    if (this.proxy) {
      obj.proxy = this.proxy
    }

    return obj
  }
}
