import fs from "fs-extra"
import os from "os"
import { ScriptError } from "../ScriptError"
import * as util from "../util"
import { Script } from "vm"
import { statement } from "@babel/template"

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

    this.uid = userInfo.uid
    this.gid = userInfo.gid

    if (ownerNode) {
      if (ownerNode.type !== "object") {
        throw new ScriptError("'owner' must be of type object", ownerNode)
      }

      const { user: userNode, group: groupNode } = ownerNode.value

      if (userNode) {
        if (userNode.type !== "string" && userNode.type !== "number") {
          throw new ScriptError(
            "'user' must be of type string or number",
            userNode
          )
        }

        const users = await this.util.getUsers(this.fs)
        const func =
          userNode.type === "string"
            ? (u) => u.name === userNode.value
            : (u) => u.uid === userNode.value
        const user = users.find(func)

        if (user === undefined) {
          throw new ScriptError(
            `'user' value '${userNode.value}' not valid`,
            userNode
          )
        }

        this.uid = user.uid
      }

      if (groupNode) {
        if (groupNode.type !== "string" && groupNode.type !== "number") {
          throw new ScriptError(
            "'group' must be of type string or number",
            groupNode
          )
        }

        const groups = await this.util.getGroups(this.fs)
        const func =
          groupNode.type === "string"
            ? (g) => g.name === groupNode.value
            : (g) => g.gid === groupNode.value
        const group = groups.find(func)

        if (group === undefined) {
          throw new ScriptError(
            `'group' value ${groupNode.value} not valid`,
            groupNode
          )
        }

        this.gid = group.gid
      }
    }

    this.mode = 0o644 // Default to -rw-r--r-- mode

    const parseModeNode = (node) => {
      const s = node.value

      if (
        node.type === "string" &&
        s.length === 3 &&
        (s[0] === "r" || s[0] === "-") &&
        (s[1] === "w" || s[1] === "-") &&
        (s[2] === "x" || s[2] === "-")
      ) {
        return (
          (s[0] === "r" ? 4 : 0) |
          (s[1] === "w" ? 2 : 0) |
          (s[2] === "x" ? 1 : 0)
        )
      } else {
        throw new ScriptError(
          `Mode must be a string in the order 'rwx', with a dash if a permission is not present`,
          node
        )
      }
    }

    if (modeNode) {
      if (modeNode.type !== "object") {
        throw new ScriptError(`'mode' flags must be specified`)
      }

      const {
        user: userNode,
        group: groupNode,
        other: otherNode,
      } = modeNode.value
      let mode = 0

      if (userNode) {
        mode |= parseModeNode(userNode) << 6
      }

      if (groupNode) {
        mode |= parseModeNode(groupNode) << 3
      }

      if (otherNode) {
        mode |= parseModeNode(otherNode)
      }

      this.mode = mode
    }

    this.expandedPath = this.expandStringNode(pathNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedPath)
    } catch (e) {
      return false
    }

    if (stat) {
      if (stat.isFile()) {
        throw new ScriptError(
          `A file with the name '${this.expandedPath}' exists`,
          pathNode
        )
      } else if (stat.uid !== this.uid || stat.gid !== this.gid) {
        if (userInfo.uid !== 0) {
          throw new ScriptError(
            "User does not have permission to modify existing directory owner",
            assertNode
          )
        }

        return false
      } else if ((stat.mode & 0o777) !== this.mode) {
        if (userInfo.uid !== stat.uid || userInfo.gid !== stat.gid) {
          throw new ScriptError(
            "User does not have permission to existing modify permisions"
          )
        }

        return false
      }
    }

    return true
  }

  async rectify() {
    await this.fs.ensureDir(this.expandedPath)
    await this.fs.chmod(this.expandedPath, this.mode)
    await this.fs.chown(this.expandedPath, this.uid, this.gid)
  }

  result() {
    return { path: this.expandedPath }
  }
}
