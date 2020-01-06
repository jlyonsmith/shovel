import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"
import Timeout from "await-timeout"

export class ServiceRunning {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.util = container.util || util
    this.Timeout = container.Timeout || Timeout
    this.interpolator = container.interpolator
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

    this.expandedServiceName = this.interpolator(serviceNode)

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
    await this.childProcess.exec(
      `systemctl restart ${this.expandedServiceName}`
    )

    let output = null
    let numTries = 0

    do {
      output = await this.childProcess.exec(
        `systemctl is-active ${this.expandedServiceName}`
      )

      if (output.stdout.startsWith("active")) {
        return
      }

      // Wait to check again
      await new this.Timeout().set(1000)

      numTries += 1
    } while (numTries < 10)

    throw new Error("Service failed to start")
  }

  result() {
    return { service: this.expandedServiceName }
  }
}
