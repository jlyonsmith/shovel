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
      return !(await this.fs.readFile("/etc/passwd")).includes(
        nameNode.value + ":"
      )
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can delete users")
    }

    await this.childProcess.exec(`userdel ${nameNode.value}`)
  }
}
