import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

/*
Checks and ensures that a file does not exist.

Example:

{
  assert: "FileAbsent",
  with: {
    path: "/path/to/file"
  }
}
*/

export class FileAbsent {
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
    let ok = true

    try {
      stat = await this.fs.lstat(this.expandedPath)
      ok = false
    } catch (e) {}

    if (stat && stat.isDirectory()) {
      throw new ScriptError(
        `Not removing existing directory with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    return ok
  }

  async rectify() {
    await this.fs.unlink(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
