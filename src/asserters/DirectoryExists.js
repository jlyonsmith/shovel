import fs from "fs-extra"
import { ScriptError } from "../ScriptError"

/*
Checks and ensures that a directory exists.

Example:

{
  assert: "DirectoryExists",
  with: {
    path: <string>,
    owner: <string>,
    perms: <string>,
  }
}
*/

// TODO: support owner (as user:group)
// TODO: Support perms (as ugo=rwx)

export class DirectoryExists {
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
    let ok

    try {
      stat = await this.fs.lstat(this.expandedPath)
      ok = true
    } catch (e) {
      ok = false
    }

    if (ok && stat.isFile()) {
      throw new ScriptError(
        `A file with the name '${this.expandedPath}' exists`,
        pathNode
      )
    }

    return ok
  }

  async rectify() {
    await this.fs.ensureDir(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
