import childProcess from "child-process-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class ServiceRunning {
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
    // TODO: Do not run sudo directly here
    await this.childProcess.exec(
      `sudo systemctl restart ${this.expandedServiceName}`
    )

    let output = null

    do {
      output = await this.childProcess.exec(
        `sudo systemctl is-active ${this.expandedServiceName}`
      )

      if (output.stdout === "failed" || output.stdout === "inactive") {
        throw new Error(`Service failed to go into the active state`)
      }
    } while (output.stdout !== "active")
  }

  result() {
    return { service: this.expandedServiceName }
  }
}
