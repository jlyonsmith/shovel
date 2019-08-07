import fs from "fs-extra"
import childProcess from "child-process-promise"
import * as util from "../util"

/*
Asserts and ensures that an O/S package is installed

Example:

{
  assert: "PackageInstalled",
  with: {
    name: <string> | <array>,
  }
}

*/

// TODO: Support version number

export class PackageInstalled {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
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

    try {
      await this.childProcess.exec(`dpkg --list ${this.expandedName}`)
    } catch (e) {
      return false
    }

    return true
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to install packages",
        this.withNode
      )
    }

    await this.childProcess.exec(`apt install -y ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
