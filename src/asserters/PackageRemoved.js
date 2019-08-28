import childProcess from "child-process-promise"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

/*
Asserts and ensures that an O/S package is installed

Example:

{
  assert: "PackageRemoved",
  with: {
    name: <string> | <array>,
  }
}

*/

export class PackageRemoved {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
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

    try {
      await this.childProcess.exec(`dpkg --list ${this.expandedName}`)
    } catch (e) {
      return true
    }

    return false
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to remove packages",
        withNode
      )
    }

    await this.childProcess.exec(`apt remove -y ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
