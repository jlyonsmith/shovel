import childProcess from "child-process-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

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

export class PackageInstalled {
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

    const info = await this.util.osInfo()

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
      this.installCommand = `apt install -y ${this.expandedName}`
    } else {
      command = `rpm -qa | grep '^${this.expandedName}-[0-9]'`
      this.installCommand = `yum install -y ${this.expandedName}`
    }

    try {
      await this.childProcess.exec(command)
    } catch {
      if (!this.util.runningAsRoot()) {
        throw new ScriptError(
          "Must be running as root to install packages",
          withNode
        )
      }

      return false
    }

    return true
  }

  async rectify() {
    await this.childProcess.exec(this.installCommand)
  }

  result() {
    return { name: this.expandedName }
  }
}
