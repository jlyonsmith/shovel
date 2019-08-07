import fs from "fs-extra"
import childProcess from "child-process-promise"
import os from "os"
import * as util from "../util"

/*
Asserts and ensures that a user is disabled.

Example:

{
  assert: "UserDisabled",
  with: {
    name: <string>,
  }
}

See https://www.thegeekdiary.com/unix-linux-how-to-lock-or-disable-an-user-account/ for more details
*/

export class UserDisabled {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
    this.assertNode = container.assertNode
    this.util = container.util || util
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

    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to check for disabled accounts",
        this.withNode
      )
    }

    const shadow = await this.fs.readFile("/etc/shadow")
    const m = shadow.match(
      new RegExp(this.expandedName + ":.*:.*:.*:.*:.*:(.*):.*")
    )

    return m && m[1] === "1"
  }

  async rectify() {
    await this.childProcess.exec(`usermod -e 1 ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
