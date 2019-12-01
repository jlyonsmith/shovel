import fs from "fs-extra"
import childProcess from "child-process-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

/*
Asserts and ensures that a group is absent.

Example:

{
  assert: "GroupDeleted",
  with: {
    name: "string",
  }
}
*/

export class GroupDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.childProcess = container.childProcess || childProcess
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

    const groups = await this.util.getGroups()
    const ok =
      groups.find((group) => group.name === this.expandedName) === undefined

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError("Only root user can delete groups", assertNode)
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`groupdel ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
