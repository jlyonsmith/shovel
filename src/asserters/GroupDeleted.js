import fs from "fs-extra"
import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class GroupDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.childProcess = container.childProcess || childProcess
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { group: groupNode } = withNode.value

    if (!groupNode || groupNode.type !== "string") {
      throw new ScriptError(
        "'group' must be supplied and be a string",
        groupNode || withNode
      )
    }

    this.expandedGroupName = this.interpolator(groupNode)

    const groups = await this.util.getGroups()
    const ok =
      groups.find((group) => group.name === this.expandedGroupName) ===
      undefined

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError("Only root user can delete groups", assertNode)
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`groupdel ${this.expandedGroupName}`)
  }

  result() {
    return { group: this.expandedGroupName }
  }
}
