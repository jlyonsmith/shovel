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

    const ok = !(await this.fs.readFile("/etc/passwd")).includes(
      this.expandedName + ":"
    )

    if (!ok && !util.runningAsRoot(this.os)) {
      throw new ScriptError("Only root user can delete users", assertNode)
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`userdel ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
