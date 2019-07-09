import fs from "fs-extra"
import * as util from "./util"

/*
Ensures that a text file contains specific contents.

Example:

{
  assert: "FileContains",
  with: {
    path: <string>,
    contents: <string>
  }
}
*/

// TODO: Add ability not replace whole file

export class FileContains {
  constructor(container) {
    this.fs = container.fs || fs
    this.newScriptError = container.newScriptError
  }

  async assert(args) {
    this.args = args

    const { path: pathNode, contents: contentsNode } = args

    if (!pathNode || pathNode.type !== "string") {
      throw this.newScriptError(
        "'path' must be supplied and be a string",
        pathNode
      )
    }

    if (!contentsNode || contentsNode.type !== "string") {
      throw this.newScriptError(
        "'contents' must be supplied and be a string",
        pathNode
      )
    }

    try {
      const pathDigest = await util.generateDigestFromFile(
        this.fs,
        pathNode.value
      )
      const contentsDigest = util.generateDigest(contentsNode.value)

      return pathDigest === contentsDigest
    } catch (e) {
      return false
    }
  }

  async actualize() {
    const { path: pathNode, contents: contentsNode } = this.args

    await this.fs.outputFile(pathNode.value, contentsNode.value)
  }
}
