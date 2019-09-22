import fs from "fs-extra"
import os from "os"
import { ScriptError } from "../ScriptError"
import util from "../util"
import path from "path"

/*
Checks and ensures that a directory exists.

Example:

{
  assert: "DirectoryExists",
  with: {
    path: <string>,
    owner: {
      user: <string>,
      group: <string>
    },
    mode: {
      user: <string>,
      group: <string>,
      other: <string>,
    }
  }
}
*/

export class DirectoryExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
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
    const users = await this.util.getUsers(this.fs)
    const groups = await this.util.getGroups(this.fs)

    this.owner = Object.assign(
      { uid: userInfo.uid, gid: userInfo.gid },
      this.util.parseOwnerNode(users, groups, ownerNode)
    )
    this.mode = this.util.parseModeNode(modeNode)
    this.expandedPath = this.expandStringNode(pathNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedPath)
    } catch (e) {
      // Ensure the root of the directory is accessible
      if (!(await this.util.canAccess(path.dirname(this.expandedPath)))) {
        throw new ScriptError(e.message, pathNode)
      }

      return false
    }

    if (stat.isFile()) {
      throw new ScriptError(
        `A file with the name '${this.expandedPath}' exists`,
        pathNode
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
    await this.fs.ensureDir(this.expandedPath)
    await this.fs.chmod(this.expandedPath, this.mode)
    await this.fs.chown(this.expandedPath, this.owner.uid, this.owner.gid)
  }

  result() {
    return { path: this.expandedPath }
  }
}
