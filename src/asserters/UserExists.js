import fs from "fs-extra"
import childProcess from "child-process-es6-promise"
import util from "../util.js"
import { ScriptError } from "../ScriptError.js"

export class UserExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.childProcess = container.childProcess || childProcess
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      user: userNode,
      uid: uidNode,
      gid: gidNode,
      shell: shellNode,
      homeDir: homeDirNode,
      comment: commentNode,
    } = withNode.value

    if (!userNode || userNode.type !== "string") {
      throw new ScriptError(
        "'user' must be supplied and be a string",
        userNode || withNode
      )
    }

    this.user = {}

    if (uidNode) {
      if (uidNode.type !== "number") {
        throw new ScriptError("'uid' must be a number", uidNode)
      }

      this.user.uid = uidNode.value
    }

    if (gidNode) {
      if (gidNode.type !== "number") {
        throw new ScriptError("'gid' must be a number", gidNode)
      }

      this.user.gid = gidNode.value
    }

    if (shellNode) {
      if (shellNode.type !== "string") {
        throw new ScriptError("'shell' must be a string", shellNode)
      }

      this.user.shell = shellNode.value
    }

    if (homeDirNode) {
      if (homeDirNode.type !== "string") {
        throw new ScriptError("'homeDir' must be a string", homeDirNode)
      }

      this.user.homeDir = homeDirNode.value
    }

    if (commentNode) {
      if (commentNode.type !== "string") {
        throw new ScriptError("'comment' must be a string", commentNode)
      }

      this.user.comment = commentNode.value
    }

    this.expandedName = this.interpolator(userNode)

    const user = (await this.util.getUsers(this.fs)).find(
      (user) => user.name === this.expandedName
    )
    const runningAsRoot = this.util.runningAsRoot()

    if (user) {
      if (
        (this.user.uid !== undefined && this.user.uid !== user.uid) ||
        (this.user.gid !== undefined && this.user.gid !== user.gid) ||
        (this.user.shell !== undefined && this.user.shell !== user.shell) ||
        (this.user.homeDir !== undefined &&
          this.user.homeDir !== user.homeDir) ||
        (this.user.comment !== undefined && this.user.comment !== user.comment)
      ) {
        if (!runningAsRoot) {
          throw new ScriptError("Only root user can modify users", assertNode)
        }

        this.modify = true
        return false
      } else {
        return true
      }
    } else {
      if (!runningAsRoot) {
        throw new ScriptError("Only root user can add users", assertNode)
      }

      return false
    }
  }

  async rectify() {
    const addArg = (arg, value, quote) =>
      value !== undefined
        ? " " + arg + " " + (quote ? "'" + value + "'" : value)
        : ""
    const command =
      (this.modify ? "usermod" : "useradd") +
      addArg("-u", this.user.uid) +
      addArg("-g", this.user.gid) +
      addArg("-s", this.user.shell) +
      addArg("-h", this.user.homeDir) +
      addArg("-c", this.user.comment, true) +
      " " +
      this.expandedName

    await this.childProcess.exec(command)

    const user = (await this.util.getUsers()).find(
      (user) => user.name === this.expandedName
    )

    if (!user) {
      throw new Error(`User ${this.expandedName} not present in /etc/passwd`)
    }

    this.user = user
  }

  result() {
    const { name, uid, gid, shell, homeDir, comment } = this.user
    return {
      name,
      uid,
      gid,
      shell,
      homeDir,
      comment,
    }
  }
}
