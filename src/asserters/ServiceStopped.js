import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class ServiceStopped {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { service: serviceNode } = withNode.value

    if (!serviceNode || serviceNode.type !== "string") {
      throw new ScriptError(
        "'service' must be supplied and be a string",
        serviceNode || withNode
      )
    }

    this.expandedServiceName = this.expandStringNode(serviceNode)

    const output = await this.childProcess.exec(
      `systemctl is-active ${this.expandedServiceName}`
    )

    const ok = output.stdout === "inactive" || output.stdout === "failed"

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to stop services",
        assertNode
      )
    }

    return ok
  }

  async rectify() {
    // TODO: This should not be running sudo directly!
    await this.childProcess.exec(
      `sudo systemctl stop ${this.expandedServiceName}`
    )

    let output = null

    do {
      output = await this.childProcess.exec(
        `systemctl is-active ${this.expandedServiceName}`
      )
      // TODO: Put a wait in here!
    } while (output.stdout !== "inactive" && output.stdout !== "failed")
  }

  result() {
    return { service: this.expandedServiceName }
  }
}
