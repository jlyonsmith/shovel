import fs from "fs-extra"
import * as util from "../util"
import { ScriptError } from "../ScriptError"

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

export class FileContains {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { path: pathNode, contents: contentsNode } = withNode.value

    if (!pathNode || pathNode.type !== "string") {
      throw new ScriptError(
        "'path' must be supplied and be a string",
        pathNode || withNode
      )
    }

    if (!contentsNode || contentsNode.type !== "string") {
      throw new ScriptError(
        "'contents' must be supplied and be a string",
        contentsNode || withNode
      )
    }

    this.expandedPath = this.expandStringNode(pathNode)
    this.expandedContents = this.expandStringNode(contentsNode)

    try {
      await this.fs.access(
        this.expandedPath,
        fs.constants.W_OK | fs.constants.R_OK
      )
    } catch (e) {
      throw new ScriptError(e.message, pathNode)
    }

    const pathDigest = await this.util.generateDigestFromFile(
      this.fs,
      this.expandedPath
    )
    const contentsDigest = this.util.generateDigest(this.expandedContents)

    return pathDigest === contentsDigest
  }

  async rectify() {
    await this.fs.outputFile(this.expandedPath, this.expandedContents)
  }

  result() {
    return { path: this.expandedPath, contents: this.expandedContents }
  }
}
