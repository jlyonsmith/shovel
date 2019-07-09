import fs from "fs-extra"
import childProcess from "child_process"
import os from "os"
import * as util from "./util"

/*
Asserts and ensures that a user exists with UID, GID, shell and/or system priveges.

Example:

{
  assert: "UserExists",
  with: {
    name: "string",
  }
}
*/

// TODO: Support {uid: "number",}
// TODO: Support {gid: "number",}
// TODO: Support {system: "boolean",}
// TODO: Support {shell: "string"}
// TODO: Support {locked: "boolean"}.  See https://www.thegeekdiary.com/unix-linux-how-to-lock-or-disable-an-user-account/

export class UserExists {
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
      return (await this.fs.readFile("/etc/passwd")).includes(
        nameNode.value + ":"
      )
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { name: nameNode } = this.args

    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can add or modify users")
    }

    await this.childProcess.exec(`useradd ${nameNode.value}`)
  }
}
