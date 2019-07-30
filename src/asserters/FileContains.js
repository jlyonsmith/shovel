import fs from "fs-extra"
import * as util from "../util"

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
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
  }

  async assert(args) {
    this.args = args

    const { path: pathNode, contents: contentsNode } = args

    if (!pathNode || pathNode.type !== "string") {
      throw this.newScriptError(
        "'path' must be supplied and be a string",
        pathNode || this.withNode
      )
    }

    if (!contentsNode || contentsNode.type !== "string") {
      throw this.newScriptError(
        "'contents' must be supplied and be a string",
        contentsNode || this.withNode
      )
    }

    this.expandedPath = this.expandStringNode(pathNode)
    this.expandedContents = this.expandStringNode(contentsNode)

    let pathDigest = null

    try {
      pathDigest = await util.generateDigestFromFile(this.fs, this.expandedPath)
    } catch (e) {
      return false
    }
    const contentsDigest = util.generateDigest(this.expandedContents)

    return pathDigest === contentsDigest
  }

  async rectify() {
    await this.fs.outputFile(this.expandedPath, this.expandedContents)
  }

  result() {
    return { path: this.expandedPath, contents: this.expandedContents }
  }
}
