import childProcess from "child-process-promise"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

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

    this.expandedName = this.expandStringNode(nameNode)

    const output = await this.childProcess.exec(
      `systemctl is-active ${this.expandedName}`
    )

    return output.stdout === "inactive" || output.stdout === "failed"
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to stop services",
        withNode
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
