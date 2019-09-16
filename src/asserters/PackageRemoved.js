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

    const info = await this.util.getOSInfo()

    if (
      info.platform !== "linux" ||
      (info.id !== "ubuntu" && info.id !== "centos")
    ) {
      throw new ScriptError("Only supported on Ubuntu and CentOS", assertNode)
    }

    this.expandedName = this.expandStringNode(nameNode)

    let command

    if (info.id === "ubuntu") {
      command = `dpkg --list ${this.expandedName}`
      this.installCommand = `apt remove -y ${this.expandedName}`
    } else {
      command = `rpm -qa | grep '^${this.expandedName}-[0-9]'`
      this.installCommand = `yum remove -y ${this.expandedName}`
    }

    try {
      await this.childProcess.exec(command)
    } catch (e) {
      return true
    }

    if (!this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to remove packages",
        withNode
      )
    }

    return false
  }

  async rectify() {
    await this.childProcess.exec(`apt remove -y ${this.expandedName}`)
  }

  result() {
    return { name: this.expandedName }
  }
}
