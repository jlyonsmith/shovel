import fs from "fs-extra"
import childProcess from "child_process"
import os from "os"
import * as util from "./util"

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
    this.expandString = container.expandString
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

    this.expandedName = this.expandString(nameNode.value)

    return !(await this.fs.readFile("/etc/passwd")).includes(
      this.expandedName + ":"
    )
  }

  async actualize() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      // TODO: Should point to the parent node
      throw this.newScriptError("Only root user can delete users", nameNode)
    }

    await this.childProcess.exec(`userdel ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
