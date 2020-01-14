import childProcess from "child-process-es6-promise"
import { ScriptError } from "../ScriptError"
import path from "path"
import fs from "fs-extra"
import util from "../util"
import camelCase from "camelcase"

const updateDeviceUri = 1 << 0
const updateShared = 1 << 1
const updateErrorPolicy = 1 << 2
const updateInfo = 1 << 3
const updateLocation = 1 << 4
const updatePpdFile = 1 << 5
const updatePpdOptions = 1 << 6
const updateAccepting = 1 << 7

export class CupsPrintQueueExists {
  constructor(container) {
    this.childProcess = container.childProcess || childProcess
    this.fs = container.fs || fs
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      queue: queueNode,
      deviceUri: deviceUriNode,
      shared: sharedNode,
      errorPolicy: errorPolicyNode,
      location: locationNode,
      accepting: acceptingNode,
      info: infoNode,
      ppdFile: ppdFileNode,
      ppdOptions: ppdOptionsNode,
    } = withNode.value

    const info = await this.util.osInfo()

    if (
      info.platform !== "linux" ||
      (info.id !== "ubuntu" && info.id !== "centos")
    ) {
      throw new ScriptError("Only supported on Ubuntu and CentOS", assertNode)
    }

    const cupsdContent = await this.fs.readFile("/etc/cups/cupsd.conf", {
      encoding: "utf8",
    })
    const dirtyCleanRegex = /DirtyCleanInterval +0/m

    if (!dirtyCleanRegex.test(cupsdContent)) {
      throw new ScriptError(
        "DirtyCleanInterval must be set to zero /etc/cups/cupsd.conf for this asserter", this.assertNode
      )
    }

    if (!queueNode || queueNode.type !== "string") {
      throw new ScriptError(
        "'queue' must be supplied and be a string",
        queueNode || withNode
      )
    }

    this.queueName = this.interpolator(queueNode)

    if (this.queueName !== this.queueName.toLowerCase()) {
      throw new ScriptError("'queue' must be all lowercase", queueNode)
    }

    if (!deviceUriNode || deviceUriNode.type !== "string") {
      throw new ScriptError(
        "'deviceUri' must be supplied and be a string",
        deviceUriNode || withNode
      )
    }

    this.deviceUri = this.interpolator(deviceUriNode)
    this.shared = false

    if (sharedNode) {
      if (sharedNode.type !== "boolean") {
        throw new ScriptError("'shared' must be 'boolean'", sharedNode)
      }

      this.shared = sharedNode.value
    }

    this.errorPolicy = "stop-printer"

    if (errorPolicyNode) {
      if (errorPolicyNode.type !== "string") {
        throw new ScriptError("'errorPolicy' must be 'string'", errorPolicyNode)
      }

      this.errorPolicy = errorPolicyNode.value

      if (
        this.errorPolicy !== "abort-job" &&
        this.errorPolicy !== "stop-printer" &&
        this.errorPolicy !== "retry-job" &&
        this.errorPolicy !== "retry-current-job"
      ) {
        throw new ScriptError(
          "'errorPolicy' must be 'abort-job', 'stop-printer', 'retry-job' or 'retry-current-job'.",
          errorPolicyNode
        )
      }
    }

    if (locationNode) {
      if (locationNode.type !== "string") {
        throw new ScriptError("'location' must be 'string'", locationNode)
      }

      this.location = locationNode.value
    }

    if (infoNode) {
      if (infoNode.type !== "string") {
        throw new ScriptError("'info' must be a 'string'", infoNode)
      }

      this.info = infoNode.value
    }

    this.accepting = true

    if (acceptingNode) {
      if (acceptingNode.type !== "boolean") {
        throw new ScriptError("'accepting' must be a 'boolean'", acceptingNode)
      }

      this.accepting = acceptingNode.value
    }

    let existingPpdFileContent = ""

    if (ppdFileNode) {
      if (ppdFileNode.type !== "string") {
        throw new ScriptError("'ppdFile' must be 'string'", ppdFileNode)
      }

      this.ppdFile = this.interpolator(ppdFileNode)

      if ((await this.util.pathInfo(this.ppdFile)).getAccess().isReadable()) {
        this.ppdFileContent = await this.fs.readFile(this.ppdFile, {
          encoding: "utf8",
        })
      } else {
        throw new ScriptError(
          `Unable to read PPD file '${this.ppdFile}'`,
          ppdFileNode
        )
      }

      // If ppdFile given check for /etc/cups/ppd/ for the file for comparison later
      const existingPpdFile =
        path.join("/etc/cups/ppd", this.queueName) + ".ppd"

      if (
        (await this.util.pathInfo(existingPpdFile)).getAccess().isReadable()
      ) {
        existingPpdFileContent = await this.fs.readFile(existingPpdFile, {
          encoding: "utf8",
        })
      }
    }

    let existingPpdOptions = {}

    if (ppdOptionsNode) {
      if (ppdOptionsNode.type !== "object") {
        throw new ScriptError(
          "'ppdOptions' must be an 'object'",
          ppdOptionsNode
        )
      }

      if (!ppdFileNode) {
        throw new ScriptError(
          "'ppdFile' must be specified with 'ppdOptions'",
          ppdOptionsNode
        )
      }

      this.ppdOptions = {}

      for (const [name, ppdOptionNode] of Object.entries(
        ppdOptionsNode.value
      )) {
        if (ppdOptionNode.type !== "string") {
          throw new ScriptError(
            `All options values must be strings`,
            ppdOptionsNode
          )
        }

        this.ppdOptions[name] = ppdOptionNode.value
      }

      const parsePrinterOptions = (conf) => {
        const re = /^Dest (.*?) (.*)$/gm
        const allOptions = new Map()
        let match

        while ((match = re.exec(conf)) !== null) {
          const options = {}

          match[2].split(" ").forEach((keyValue) => {
            const [key, value] = keyValue.split("=")

            options[key] = value
          })

          allOptions.set(match[1], options)
        }

        return allOptions
      }

      const lpoptionsFile = "/etc/cups/lpoptions"

      if ((await this.util.pathInfo(lpoptionsFile)).getAccess().isReadable()) {
        const allOptions = parsePrinterOptions(
          await this.fs.readFile(lpoptionsFile)
        )

        if (allOptions.has(this.queueName)) {
          existingPpdOptions = allOptions.get(this.queueName)
        }
      }
    }

    if (!this.util.runningAsRoot()) {
      throw new ScriptError(
        "Must be running as root to modify print queues",
        withNode
      )
    }

    const parsePrintQueues = (conf) => {
      const parseQueueInfo = (block) => {
        const re = /^(.+?) +(.*)$/gm
        const queueInfo = {}
        let match

        while ((match = re.exec(block)) !== null) {
          let value = match[2]

          if (value === "True" || value === "Yes") {
            value = true
          } else if (value === "False" || value === "No") {
            value = false
          }

          queueInfo[camelCase(match[1])] = value
        }

        if (queueInfo.info === undefined) {
          queueInfo.info = ""
        }

        if (queueInfo.location === undefined) {
          queueInfo.location = ""
        }

        return queueInfo
      }
      const re = /^<Printer (.*)>\n((?:^.*\n)*?)^<\/Printer>\n?/gm
      const printQueues = new Map()
      let match

      while ((match = re.exec(conf)) !== null) {
        printQueues.set(match[1], parseQueueInfo(match[2]))
      }

      return printQueues
    }

    const printersFile = "/etc/cups/printers.conf"
    let printersFileContent = ""

    if ((await this.util.pathInfo(printersFile)).isFile()) {
      printersFileContent = await this.fs.readFile(printersFile, {
        encoding: "utf8",
      })
    }

    let queueInfo = parsePrintQueues(printersFileContent).get(this.queueName)

    if (!queueInfo) {
      queueInfo = { queueName: this.queueName }
    }

    this.updateFlags = 0

    if (queueInfo.deviceUri !== this.deviceUri) {
      this.updateFlags |= updateDeviceUri
    }

    if (queueInfo.shared !== this.shared) {
      this.updateFlags |= updateShared
    }

    if (queueInfo.errorPolicy !== this.errorPolicy) {
      this.updateFlags |= updateErrorPolicy
    }

    if (locationNode && queueInfo.location !== this.location) {
      this.updateFlags |= updateLocation
    }

    if (infoNode && queueInfo.info !== this.info) {
      this.updateFlags |= updateInfo
    }

    if (queueInfo.accepting !== this.accepting) {
      this.updateFlags |= updateAccepting
    }

    if (
      this.ppdFile &&
      this.ppdFileContent &&
      existingPpdFileContent !== this.ppdFileContent
    ) {
      this.updateFlags |= updatePpdFile
    }

    let optionsEqual =
      this.ppdOptions &&
      Object.keys(existingPpdOptions).every(
        (key) => this.ppdOptions[key] === existingPpdOptions[key]
      ) &&
      Object.keys(this.ppdOptions).every(
        (key) => existingPpdOptions[key] === this.ppdOptions[key]
      )

    if (!optionsEqual) {
      this.updateFlags |= updatePpdOptions
    }

    return this.updateFlags === 0
  }

  async rectify() {
    if (this.updateFlags & updateDeviceUri) {
      this.childProcess.exec(
        `lpadmin -p ${this.queueName} -v ${this.deviceUri}`
      )
    }

    if (this.updateFlags & updateErrorPolicy) {
      this.childProcess.exec(
        `lpadmin -p ${this.queueName} -o printer-error-policy=${this.errorPolicy}`
      )
    }

    if (this.updateFlags & updateShared) {
      this.childProcess.exec(
        `lpadmin -p ${this.queueName} -o printer-is-shared=${this.shared}`
      )
    }

    if (this.updateFlags & updateLocation) {
      this.childProcess.exec(
        `lpadmin -p ${this.queueName} -L "${this.location}"`
      )
    }

    if (this.updateFlags & updateInfo) {
      this.childProcess.exec(`lpadmin -p ${this.queueName} -D "${this.info}"`)
    }

    if (this.updateFlags & updatePpdFile) {
      this.childProcess.exec(
        `lpadmin -p ${this.queueName} -P "${this.ppdFile}"`
      )
    }

    if (this.updateFlags & updatePpdOptions) {
      let optionList = Object.entries(this.ppdOptions)
        .map(([key, value]) => `'-o ${key}="${value}"'`)
        .join(" ")

      this.childProcess.exec(`lpoptions -p ${this.queueName} ${optionList}`)
    }

    if (this.updateFlags & updateAccepting) {
      if (this.accepting) {
        this.childProcess.exec(`cupsenable ${this.queueName}`)
        this.childProcess.exec(`cupsaccept ${this.queueName}`)
      } else {
        this.childProcess.exec(`cupsdisable ${this.queueName}`)
        this.childProcess.exec(`cupsreject ${this.queueName}`)
      }
    }
  }

  result(rectified) {
    const result = {
      queue: this.queueName,
      deviceUri: this.deviceUri,
      errorPolicy: this.errorPolicy,
      shared: this.shared,
      accepting: this.accepting,
    }

    if (this.location) {
      result.location = this.location
    }

    if (this.info) {
      result.info = this.info
    }

    if (this.ppdFile) {
      result.ppdFile = this.ppdFile
    }

    if (this.ppdOptions) {
      result.ppdOptions = this.ppdOptions
    }

    if (rectified) {
      result.updateFlags = this.updateFlags.toString(2)
    }

    return result
  }
}
