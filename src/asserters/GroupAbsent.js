import fs from "fs-extra"
import childProcess from "child_process"
import * as util from "./util"
import os from "os"

/*
Asserts and ensures that a group is absent.

Example:

{
  assert: "GroupAbsent",
  with: {
    name: "string",
  }
}
*/

export class GroupAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
  }

  async assert(args) {
    this.args = args
    try {
      return !(await this.fs.readFile("/etc/groups")).includes(args.name + ":")
    } catch (e) {
      return false
    }
  }

  async actualize() {
    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can delete groups")
    }

    await this.childProcess.exec(`groupdel ${this.args.name}`)
  }
}
