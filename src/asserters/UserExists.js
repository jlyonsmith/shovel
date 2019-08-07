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
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
    this.assertNode = container.assertNode
  }

  async assert(args) {
    this.args = args

    const { name: nameNode } = args

    if (!nameNode || nameNode.type !== "string") {
      throw this.newScriptError(
        "'name' must be supplied and be a string",
        nameNode || this.withNode
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
      throw this.newScriptError(
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
