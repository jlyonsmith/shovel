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

    const output = await this.childProcess.exec(
      `systemctl is-active ${this.expandedName}`
    )

    return output.stdout === "inactive" || output.stdout === "failed"
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to stop services",
        this.withNode
      )
    }

    await this.childProcess.exec(`sudo systemctl stop ${this.expandedName}`)

    let output = null

    do {
      output = await this.childProcess.exec(
        `systemctl is-active ${this.expandedName}`
      )
    } while (output.stdout !== "inactive" && output.stdout !== "failed")
  }

  result() {
    return { name: this.expandedName }
  }
}
