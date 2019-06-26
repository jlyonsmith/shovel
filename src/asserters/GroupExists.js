import fs from "fs-extra"
import childProcess from "child_process"
import * as util from "./util"
import os from "os"

/*
Asserts and ensures that a group exists.

Example:

{
  assert: "GroupExists",
  with: {
    name: "string",
  }
}
*/

// TODO: Support {gid: "number"}

export class GroupExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.childProcess = container.childProcess || childProcess
    this.os = container.os || os
  }

  async assert(args) {
    this.args = args
    try {
      return (await this.fs.readFile("/etc/groups")).includes(args.name + ":")
    } catch (e) {
      return false
    }
  }

  async actualize() {
    if (!util.runningAsRoot(this.os)) {
      throw new Error("Only root user can add or modify groups")
    }

    await this.childProcess.exec(`groupadd ${this.args.name}`)
  }
}
