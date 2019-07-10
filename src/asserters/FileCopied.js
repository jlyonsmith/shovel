import fs from "fs-extra"
import path from "path"
import * as util from "./util"

/*
That a file was copied from one location to another.

Example:
    {
      assert: "FileCopied",
      with: {
        fromPath: <string>,
        toPath: <string>,
      },
    },
*/

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandString = container.expandString
    this.withNode = container.withNode
  }

  async assert(args) {
    this.args = args

    const { fromPath: fromPathNode, toPath: toPathNode } = args

    if (!fromPathNode || fromPathNode.type !== "string") {
      throw this.newScriptError(
        "'fromPath' must be supplied and be a string",
        fromPathNode || this.withNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw this.newScriptError(
        "'toPath' must be supplied and be a string",
        toPathNode || this.withNode
      )
    }

    this.expandedToPath = this.expandString(toPathNode.value)
    this.expandedFromPath = this.expandString(fromPathNode.value)

    if (
      !(await util.fileExists(this.fs, this.expandedFromPath)) ||
      !(await util.fileExists(this.fs, this.expandedToPath))
    ) {
      return false
    }

    const fromDigest = await util.generateDigestFromFile(
      this.fs,
      this.expandedFromPath
    )
    const toDigest = await util.generateDigestFromFile(
      this.fs,
      this.expandedToPath
    )

    return fromDigest === toDigest
  }

  async actualize() {
    const toPathDir = path.dirname(this.expandedToPath)

    if (!(await util.dirExists(this.fs, toPathDir))) {
      await this.fs.ensureDir(toPathDir)
    }

    await this.fs.copy(this.expandedFromPath, this.expandedToPath)
  }

  result() {
    return { fromPath: this.expandedFromPath, toPath: this.expandedToPath }
  }
}
