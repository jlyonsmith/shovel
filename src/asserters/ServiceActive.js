import childProcess from "child-process-promise"
import * as util from "../util"

/*
Ensures that an O/S service is running

Example:

{
  assert: "ServiceActive",
  with: {
    name: <string>,
  }
}
*/

export class ServiceActive {
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

    return output.stdout === "active"
  }

  async rectify() {
    if (!this.util.runningAsRoot()) {
      throw this.newScriptError(
        "Must be running as root to start services",
        this.withNode
      )
    }

    await this.childProcess.exec(`sudo systemctl restart ${this.expandedName}`)

    let output = null

    do {
      output = await this.childProcess.exec(
        `sudo systemctl is-active ${this.expandedName}`
      )

      if (output.stdout === "failed" || output.stdout === "inactive") {
        throw this.newScriptError(`Service failed to go into the active state`)
      }
    } while (output.stdout !== "active")
  }

  result() {
    return { name: this.expandedName }
  }
}
