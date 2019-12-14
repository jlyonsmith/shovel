import fs from "fs-extra"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.interpolateNode = container.interpolateNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { fromFile: fromFileNode, toFile: toFileNode } = withNode.value

    if (!fromFileNode || fromFileNode.type !== "string") {
      throw new ScriptError(
        "'fromFile' must be supplied and be a string",
        fromFileNode || withNode
      )
    }

    if (!toFileNode || toFileNode.type !== "string") {
      throw new ScriptError(
        "'toFile' must be supplied and be a string",
        toFileNode || withNode
      )
    }

    this.expandedToFile = this.interpolateNode(toFileNode)
    this.expandedFromFile = this.interpolateNode(fromFileNode)

    if (!(await this.util.fileExists(this.expandedFromFile))) {
      throw new ScriptError(
        `File ${this.expandedFromFile} does not exist`,
        fromFileNode
      )
    }

    if (!(await this.util.fileExists(this.expandedToFile))) {
      return false
    }

    const fromFileDigest = await this.util.generateDigestFromFile(
      this.expandedFromFile
    )
    const toFileDigest = await this.util.generateDigestFromFile(
      this.expandedToFile
    )

    return fromFileDigest === toFileDigest
  }

  async rectify() {
    await this.fs.copy(this.expandedFromFile, this.expandedToFile)
  }

  result() {
    return { fromFile: this.expandedFromFile, toFile: this.expandedToFile }
  }
}
