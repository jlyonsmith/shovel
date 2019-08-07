import childProcess from "child-process-promise"
import os from "os"
import * as util from "../util"

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
    this.os = container.os || os
    this.util = container.util || util
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
    this.assertNode = container.assertNode
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

    const output = await this.childProcess.exec(`dpkg -l`)

    return !new RegExp("\\b" + this.expandedName + "\\b").test(output)
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to remove packages",
        this.withNode
      )
    }

    await this.childProcess.exec(`apt remove -y ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
