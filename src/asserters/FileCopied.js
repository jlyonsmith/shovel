import fs from "fs-extra"
import path from "path"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

/*
That a file was copied from one location to another.

Example:
    {
      assert: "FileCopied",
      with: {
        from: <string>,
        to: <string>,
      },
    },
*/

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
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

    // TODO: Don't do this - require DirExists instead
    if (!(await util.dirExists(this.fs, toPathDir))) {
      await this.fs.ensureDir(toPathDir)
    }

    await this.fs.copy(this.expandedFromPath, this.expandedToPath)
  }

  result() {
    return { fromPath: this.expandedFromPath, toPath: this.expandedToPath }
  }
}
