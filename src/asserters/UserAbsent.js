import fs from "fs-extra"
import childProcess from "child-process-promise"
import os from "os"
import * as util from "../util"

/*
Asserts and ensures that a user is absent.

Example:

{
  assert: "UserAbsent",
  with: {
    name: "string",
  }
}
*/

export class UserAbsent {
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

    return !(await this.fs.readFile("/etc/passwd")).includes(
      this.expandedName + ":"
    )
  }

  async rectify() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      throw this.newScriptError(
        "Only root user can delete users",
        this.assertNode
      )
    }

    await this.childProcess.exec(`userdel ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
