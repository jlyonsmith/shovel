import fs from "fs-extra"
import os from "os"
import { ScriptError } from "../ScriptError"
import util from "../util"
import path from "path"

export class DirectoryExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.util = container.util || util
    this.interpolateNode = container.interpolateNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      directory: directoryNode,
      owner: ownerNode,
      mode: modeNode,
    } = withNode.value

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'directory' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    const userInfo = this.os.userInfo()
    const users = await this.util.getUsers(this.fs)
    const groups = await this.util.getGroups(this.fs)

    this.owner = Object.assign(
      { uid: userInfo.uid, gid: userInfo.gid },
      this.util.parseOwnerNode(users, groups, ownerNode)
    )
    // TODO: Default for dirs should be rwx
    this.mode = this.util.parseModeNode(modeNode)
    this.expandedDirectory = this.interpolateNode(directoryNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedDirectory)
    } catch (e) {
      // Ensure the root of the directory is accessible
      if (!(await this.util.canAccess(path.dirname(this.expandedDirectory)))) {
        throw new ScriptError(e.message, directoryNode)
      }

      return false
    }

    if (stat.isFile()) {
      throw new ScriptError(
        `A file with the name '${this.expandedDirectory}' exists`,
        directoryNode
      )
    } else if (stat.uid !== this.owner.uid || stat.gid !== this.owner.gid) {
      if (userInfo.uid !== 0) {
        throw new ScriptError(
          "User does not have permission to modify existing directory owner",
          assertNode
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
          "User does not have permission to modify existing directory mode",
          assertNode
        )
      }

      return false
    }

    return true
  }

  async rectify() {
    await this.fs.ensureDir(this.expandedDirectory)
    await this.fs.chmod(this.expandedDirectory, this.mode)
    await this.fs.chown(this.expandedDirectory, this.owner.uid, this.owner.gid)
  }

  result() {
    return { directory: this.expandedDirectory }
  }
}
