import fs from "fs-extra"
import childProcess from "child-process-promise"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

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
    this.expandStringNode = container.expandStringNode
    this.util = container.util || util
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

    if (!this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to check for disabled accounts",
        withNode
      )
    }

    const shadow = await this.fs.readFile("/etc/shadow")
    const m = shadow.match(
      new RegExp(this.expandedName + ":.*:.*:.*:.*:.*:(.*):.*")
    )

    return m && m[1] === "1"
  }

  async rectify() {
    await this.childProcess.exec(`sudo usermod -e 1 ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
