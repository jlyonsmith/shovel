import fs from "fs-extra"
import childProcess from "child-process-promise"
import os from "os"
import * as util from "../util"

/*
Asserts and ensures that a user exists with UID, GID, shell and/or system priveges.

Example:

{
  assert: "UserExists",
  with: {
    name: <string>,
    gid: <number>,
    uid: <number>,
    system: <bool>,
    shell: <string>,
  }
}
*/

// TODO: Support uid
// TODO: Support gid
// TODO: Support system
// TODO: Support shell

export class UserExists {
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

    return (await this.fs.readFile("/etc/passwd")).includes(
      this.expandedName + ":"
    )
  }

  async rectify() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      throw new ScriptError(
        "Only root user can add or modify users",
        this.assertNode
      )
    }

    await this.childProcess.exec(`useradd ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
