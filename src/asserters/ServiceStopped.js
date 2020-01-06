import childProcess from "child-process-es6-promise"
import util from "../util"
import { ScriptError } from "../ScriptError"
import Timeout from "await-timeout"

export class ServiceStopped {
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

    let ok = false

    try {
      await this.childProcess.exec(
        `systemctl is-active ${this.expandedServiceName}`
      )
    } catch {
      ok = true
    }

    if (!ok && !this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to stop services",
        assertNode
      )
    }

    return ok
  }

  async rectify() {
    await this.childProcess.exec(`systemctl stop ${this.expandedServiceName}`)

    let numTries = 0

    do {
      try {
        await this.childProcess.exec(
          `systemctl is-active ${this.expandedServiceName}`
        )
      } catch {
        return
      }

      // Wait to check again
      await new this.Timeout().set(1000)

      numTries += 1
    } while (numTries < 10)

    throw new Error("Service failed to stop")
  }

  result() {
    return { service: this.expandedServiceName }
  }
}
