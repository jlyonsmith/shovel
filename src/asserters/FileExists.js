import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

/*
Checks and ensures that a file exists.

Example:

{
  assert: "FileExists",
  with: {
    path: "/path/to/file"
  }
}
*/

// TODO: Must require owner and group
// TODO: Must require permissions

export class FileExists {
  constructor(container) {
    this.fs = container.fs || fs
    this.expandStringNode = container.expandStringNode
    this.stat = null
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { path: pathNode } = withNode.value

    if (!pathNode || pathNode.type !== "string") {
      throw new ScriptError(
        "'path' must be supplied and be a string",
        pathNode || withNode
      )
    }

    this.expandedPath = this.expandStringNode(pathNode)

    let stat = null

    try {
      stat = await this.fs.lstat(this.expandedPath)
    } catch (e) {
      return false
    }

    if (stat && stat.isDirectory()) {
      throw new ScriptError(
        `A directory exists with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    return true
  }

  async rectify() {
    this.fs.ensureFile(this.expandedPath)
  }

  result(rectified) {
    return { path: this.expandedPath }
  }
}
