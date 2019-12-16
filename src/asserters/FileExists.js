import fs from "fs-extra"
import os from "os"
import path from "path"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class FileExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.util = container.util || util
    this.interpolator = container.interpolator
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { file: fileNode, owner: ownerNode, mode: modeNode } = withNode.value

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    const userInfo = this.os.userInfo()
    const users = await this.util.getUsers()
    const groups = await this.util.getGroups()
    let stat = null
    let owner = { uid: userInfo.uid, gid: userInfo.gid }

    this.owner = Object.assign(
      owner,
      this.util.parseOwnerNode(users, groups, ownerNode)
    )
    this.mode = this.util.parseModeNode(modeNode)
    this.expandedFile = this.interpolator(fileNode)

    try {
      stat = await this.fs.lstat(this.expandedFile)
    } catch (e) {
      // Check if the target directory exists and is accessible
      if (!(await this.util.canAccess(path.dirname(this.expandedFile)))) {
        throw new ScriptError(e.message, fileNode)
      }

      return false
    }

    if (stat && stat.isDirectory()) {
      throw new ScriptError(
        `A directory exists with the name '${this.expandedFile}'`,
        fileNode
      )
    } else if (stat.uid !== this.owner.uid || stat.gid !== this.owner.gid) {
      if (userInfo.uid !== 0) {
        throw new ScriptError(
          "User does not have permission to modify existing file owner",
          fileNode
        )
      }

      return false
    } else if ((stat.mode & 0o777) !== this.mode) {
      if (
        userInfo.uid !== 0 &&
        userInfo.uid !== stat.uid &&
        userInfo.gid !== stat.gid
      ) {
        throw new ScriptError(
          "User does not have permission to modify existing file mode",
          fileNode
        )
      }

      return false
    }

    return true
  }

  async rectify() {
    const fd = await this.fs.open(this.expandedFile, "a")

    await this.fs.close(fd)
    await this.fs.chmod(this.expandedFile, this.mode)
    await this.fs.chown(this.expandedFile, this.owner.uid, this.owner.gid)
  }

  result() {
    return { file: this.expandedFile }
  }
}
