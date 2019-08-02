import fs from "fs-extra"
import path from "path"
import * as util from "../util"

/*
That a file was copied from one location to another.

Example:
    {
      assert: "FileCopied",
      with: {
        from: <string> | { path: <string>, origin: <bool> },
        to: <string>,
      },
    },
*/

// TODO: Add 'origin' to copy file from the origin system

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
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

    this.expandedToPath = this.expandStringNode(toPathNode)
    this.expandedFromPath = this.expandStringNode(fromPathNode)

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

  async rectify() {
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
