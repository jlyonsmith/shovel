import fs from "fs-extra"
import childProcess from "child-process-promise"
import * as util from "../util"
import os from "os"

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

// TODO: Support gid

export class GroupExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { name: nameNode } = withNode.value

    if (!nameNode || nameNode.type !== "string") {
      throw new ScriptError(
        "'name' must be supplied and be a string",
        nameNode || withNode
      )
    }

    this.expandedName = this.expandStringNode(nameNode)

    const ok = (await this.fs.readFile("/etc/groups")).includes(
      this.expandedName + ":"
    )

    if (!ok && !util.runningAsRoot(this.os)) {
      throw new ScriptError(
        "Only root user can add or modify groups",
        assertNode
      )
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`groupadd ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
