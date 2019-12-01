import fs from "fs-extra"
import path from "path"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { from: fromPathNode, to: toPathNode } = withNode.value

    if (!fromPathNode || fromPathNode.type !== "string") {
      throw new ScriptError(
        "'from' must be supplied and be a string",
        fromPathNode || withNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw new ScriptError(
        "'to' must be supplied and be a string",
        toPathNode || withNode
      )
    }

    this.expandedToPath = this.expandStringNode(toPathNode)
    this.expandedFromPath = this.expandStringNode(fromPathNode)

    if (!(await this.util.fileExists(this.expandedFromPath))) {
      throw new ScriptError(
        `File ${this.expandedFromPath} does not exist`,
        fromPathNode
      )
    }

    if (!(await this.util.fileExists(this.expandedToPath))) {
      return false
    }

    const fromDigest = await this.util.generateDigestFromFile(
      this.expandedFromPath
    )
    const toDigest = await this.util.generateDigestFromFile(this.expandedToPath)

    return fromDigest === toDigest
  }

  async rectify() {
    await this.fs.copy(this.expandedFromPath, this.expandedToPath)
  }

  result() {
    return { fromPath: this.expandedFromPath, toPath: this.expandedToPath }
  }
}
