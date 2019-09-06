import fs from "fs-extra"
import childProcess from "child-process-promise"
import * as util from "../util"
import os from "os"
import { ScriptError } from "../ScriptError"

/*
Asserts and ensures that a group exists.

Example:

{
  assert: "GroupExists",
  with: {
    name: <string>,
    gid: <number>,
  }
}
*/

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
    const { name: nameNode, gid: gidNode } = withNode.value

    if (!nameNode || nameNode.type !== "string") {
      throw new ScriptError(
        "'name' must be supplied and be a string",
        nameNode || withNode
      )
    }

    if (gidNode && gidNode.type !== "number") {
      throw new ScriptError("'group' must be a number", gidNode)
    }

    this.expandedName = this.expandStringNode(nameNode)

    const group = (await this.util.getGroups(this.fs)).find(
      (group) => group.name === this.expandedName
    )
    const runningAsRoot = util.runningAsRoot(this.os)

    if (group) {
      if (gidNode && gidNode.value !== group.gid) {
        if (!runningAsRoot) {
          throw new ScriptError("Only root user can  modify groups", assertNode)
        }

        this.gid = gidNode.value
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
    await this.childProcess.exec(
      `${this.modify ? "groupmod" : "groupadd"} ${
        this.gid ? "-g " + this.gid : ""
      } ${this.expandedName}`
    )

    if (!this.modify || !this.gid) {
      const group = (await this.util.getGroups(this.fs)).find(
        (group) => group.name === this.expandedName
      )

      if (!group) {
        throw new Error("Group not present in /etc/groups after groupadd")
      }

      this.gid = group.gid
    }
  }

  result(rectified) {
    return { name: this.expandedName, gid: this.gid }
  }
}
