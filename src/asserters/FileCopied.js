import fs from "fs-extra"
import util from "../util.js"
import path from "path"
import { ScriptError } from "../ScriptError.js"

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.interpolator = container.interpolator
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

    this.expandedToFile = this.interpolator(toFileNode)
    this.expandedFromFile = this.interpolator(fromFileNode)

    if (!(await this.util.pathInfo(this.expandedFromFile)).isFile()) {
      throw new ScriptError(
        `File ${this.expandedFromFile} does not exist`,
        fromFileNode
      )
    }

    if (!(await this.util.pathInfo(this.expandedToFile)).isFile()) {
      if (
        !(await this.util.pathInfo(path.dirname(this.expandedToFile)))
          .getAccess()
          .isWriteable()
      ) {
        throw new ScriptError(
          `Cannot write to parent directory of ${this.expandedToFile}`,
          toFileNode
        )
      }

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
