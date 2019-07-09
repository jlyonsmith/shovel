import fs from "fs-extra"
import childProcess from "child_process"
import * as util from "./util"
import os from "os"

/*
Asserts and ensures that a group exists.

Example:

{
  assert: "GroupExists",
  with: {
    name: "string",
  }
}
*/

// TODO: Support {gid: "number"}

export class GroupExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
    this.newScriptError = container.newScriptError
  }

  async assert(args) {
    this.args = args

    const { name: nameNode } = args

    if (!nameNode || nameNode.type !== "string") {
      throw this.newScriptError(
        "'name' must be supplied and be a string",
        nameNode
      )
    }

    try {
      return (await this.fs.readFile("/etc/groups")).includes(
        nameNode.value + ":"
      )
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can add or modify groups")
    }

    await this.childProcess.exec(`groupadd ${nameNode.value}`)
  }
}
