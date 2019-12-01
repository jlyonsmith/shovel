import fs from "fs-extra"
import childProcess from "child-process-promise"
import util from "../util"
import os from "os"
import { ScriptError } from "../ScriptError"

export class GroupExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { group: groupNode, gid: gidNode } = withNode.value

    if (!groupNode || groupNode.type !== "string") {
      throw new ScriptError(
        "'group' must be supplied and be a string",
        groupNode || withNode
      )
    }

    if (gidNode) {
      if (gidNode.type !== "number") {
        throw new ScriptError("'gid' must be a number", gidNode)
      }

      this.gid = gidNode.value
    }

    this.expandedGroupName = this.expandStringNode(groupNode)

    const group = (await this.util.getGroups()).find(
      (group) => group.name === this.expandedGroupName
    )

    const runningAsRoot = this.util.runningAsRoot()

    if (group) {
      if (this.gid === undefined) {
        this.gid = group.gid
      }

      if (this.gid !== group.gid) {
        if (!runningAsRoot) {
          throw new ScriptError("Only root user can modify groups", assertNode)
        }

        this.modify = true
        return false
      } else {
        return true
      }
    } else {
      if (!runningAsRoot) {
        throw new ScriptError("Only root user can add groups", assertNode)
      }

      return false
    }
  }

  async rectify() {
    const command =
      (this.modify ? "groupmod" : "groupadd") +
      (this.gid ? " -g " + this.gid : "") +
      " " +
      this.expandedGroupName

    await this.childProcess.exec(command)

    const group = (await this.util.getGroups()).find(
      (group) => group.name === this.expandedGroupName
    )

    if (!group) {
      throw new Error(
        `Group ${this.expandedGroupName} not present in /etc/groups`
      )
    }

    this.gid = group.gid
  }

  result(rectified) {
    return { group: this.expandedGroupName, gid: this.gid }
  }
}
