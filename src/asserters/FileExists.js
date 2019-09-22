import fs from "fs-extra"
import os from "os"
import path from "path"
import util from "../util"
import { ScriptError } from "../ScriptError"

/*
Checks and ensures that a file exists.

Example:

{
  assert: "FileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { path: pathNode, owner: ownerNode, mode: modeNode } = withNode.value

    if (!pathNode || pathNode.type !== "string") {
      throw new ScriptError(
        "'path' must be supplied and be a string",
        pathNode || withNode
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
    this.expandedPath = this.expandStringNode(pathNode)

    try {
      stat = await this.fs.lstat(this.expandedPath)
    } catch (e) {
      // Check if the target directory exists and is accessible
      if (!(await this.util.canAccess(path.dirname(this.expandedPath)))) {
        throw new ScriptError(e.message, pathNode)
      }

      return false
    }

    if (stat && stat.isDirectory()) {
      throw new ScriptError(
        `A directory exists with the name '${this.expandedPath}'`,
        pathNode
      )
    } else if (stat.uid !== this.owner.uid || stat.gid !== this.owner.gid) {
      if (userInfo.uid !== 0) {
        throw new ScriptError(
          "User does not have permission to modify existing file owner",
          pathNode
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
          pathNode
        )
      }

      return false
    }

    return true
  }

  async rectify() {
    const fd = await this.fs.open(this.expandedPath, "a")

    await this.fs.close(fd)
    await this.fs.chmod(this.expandedPath, this.mode)
    await this.fs.chown(this.expandedPath, this.owner.uid, this.owner.gid)
  }

  result() {
    return { path: this.expandedPath }
  }
}
