import childProcess from "child-process-promise"
import os from "os"
import * as util from "../util"

/*
Ensures that an O/S service is inactive

Example:

{
  assert: "ServiceActive",
  with: {
    name: <string>,
  }
}
*/

export class ServiceInactive {
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

    const state = await this.childProcess.exec(
      `systemctl show -p ActiveState ${this.expandedName}`
    )

    return state === "inactive" || state === "failed"
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to stop services",
        this.withNode
      )
    }

    await this.childProcess.exec(`systemctl stop ${this.expandedName}`)

    let state = null

    do {
      state = await this.childProcess.exec(
        `systemctl show -p ActiveState ${this.expandedName}`
      )
    } while (state !== "inactive" && state !== "failed")
  }

  result() {
    return { name: this.expandedName }
  }
}
