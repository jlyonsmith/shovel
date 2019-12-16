import fs from "fs-extra"
import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class UserDisabled {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { user: userNode } = withNode.value

    if (!userNode || userNode.type !== "string") {
      throw new ScriptError(
        "'user' must be supplied and be a string",
        userNode || withNode
      )
    }

    this.expandedName = this.interpolator(userNode)

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
    return { user: this.expandedName }
  }
}
