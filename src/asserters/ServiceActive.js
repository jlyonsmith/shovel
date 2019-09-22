import childProcess from "child-process-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

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

    const ok = output.stdout === "active"

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to start services",
        withNode
      )
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`sudo systemctl restart ${this.expandedName}`)

    let output = null

    do {
      output = await this.childProcess.exec(
        `sudo systemctl is-active ${this.expandedName}`
      )

      if (output.stdout === "failed" || output.stdout === "inactive") {
        throw new Error(`Service failed to go into the active state`)
      }
    } while (output.stdout !== "active")
  }

  result() {
    return { name: this.expandedName }
  }
}
