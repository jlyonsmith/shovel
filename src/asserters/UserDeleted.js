import fs from "fs-extra"
import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class UserDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.childProcess = container.childProcess || childProcess
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

    const ok =
      (await this.util.getUsers()).find(
        (user) => user.user === this.expandedName
      ) === undefined

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError("Only root user can delete users", assertNode)
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`userdel ${this.expandedName}`)
  }

  result() {
    return { user: this.expandedName }
  }
}
