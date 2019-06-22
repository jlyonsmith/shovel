import fs from "fs-extra"
import childProcess from "child_process"
import os from "os"
import * as util from "./util"

/*
Asserts and ensures that a user is absent.

Example:

{
  assert: "UserAbsent",
  with: {
    name: "string",
  }
}
*/

export class UserAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
  }

  async assert(args) {
    this.args = args
    try {
      return !(await this.fs.readFile("/etc/passwd")).includes(args.name + ":")
    } catch (e) {
      return false
    }
  }

  async actualize() {
    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can delete users")
    }

    await this.childProcess.exec(`userdel ${this.args.name}`)
  }
}
