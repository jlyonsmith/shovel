import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class SystemPackageInstalled {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { package: packageNode } = withNode.value

    if (!packageNode || packageNode.type !== "string") {
      throw new ScriptError(
        "'package' must be supplied and be a string",
        packageNode || withNode
      )
    }

    const info = await this.util.osInfo()

    if (
      info.platform !== "linux" ||
      (info.id !== "ubuntu" && info.id !== "centos")
    ) {
      throw new ScriptError("Only supported on Ubuntu and CentOS", assertNode)
    }

    this.expandedPackageName = this.expandStringNode(packageNode)

    let command

    if (info.id === "ubuntu") {
      command = `dpkg --list ${this.expandedPackageName}`
      this.installCommand = `apt install -y ${this.expandedPackageName}`
    } else {
      command = `rpm -qa | grep '^${this.expandedPackageName}-[0-9]'`
      this.installCommand = `yum install -y ${this.expandedPackageName}`
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
    return { package: this.expandedPackageName }
  }
}
