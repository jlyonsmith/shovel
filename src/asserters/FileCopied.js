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
  }

  async assert(args) {
    this.args = args

    const { fromPath: fromPathNode, toPath: toPathNode } = args

    if (!fromPathNode || fromPathNode.type !== "string") {
      throw this.newScriptError(
        "'fromPath' must be supplied and be a string",
        fromPathNode
      )
    }

    if (!toPathNode || toPathNode.type !== "string") {
      throw this.newScriptError(
        "'toPath' must be supplied and be a string",
        toPathNode
      )
    }

    try {
      if (
        !(await util.fileExists(this.fs, fromPathNode.value)) ||
        !(await util.fileExists(this.fs, toPathNode.value))
      ) {
        return false
      }

      const fromDigest = await util.generateDigestFromFile(
        this.fs,
        fromPathNode.value
      )
      const toDigest = await util.generateDigestFromFile(
        this.fs,
        toPathNode.value
      )

      return fromDigest === toDigest
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { fromPath: fromPathNode, toPath: toPathNode } = this.args
    const toPathDir = path.dirname(toPathNode.value)

    if (!(await util.dirExists(this.fs, toPathDir))) {
      await this.fs.ensureDir(toPathDir)
    }

    await this.fs.copy(fromPathNode.value, toPathNode.value)
  }
}
