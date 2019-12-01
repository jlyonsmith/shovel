import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "DirectoryDeleted",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryDeleted {
  constructor(container) {
    this.fs = container.fs || fs
    this.expandStringNode = container.expandStringNode
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
      return true
    }

    if (stat && stat.isFile()) {
      throw new ScriptError(
        `File exists with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    return false
  }

  async rectify() {
    await this.fs.remove(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
