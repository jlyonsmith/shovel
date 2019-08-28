import fs from "fs-extra"

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "DirectoryAbsent",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryAbsent {
  constructor(container) {
    this.fs = container.fs || fs
    this.expandStringNode = container.expandStringNode
    this.assertNode = container.assertNode
    this.stats = null
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

    try {
      this.stat = await this.fs.lstat(this.expandedPath)
      return !this.stat.isDirectory()
    } catch (e) {
      return true
    }
  }

  async rectify() {
    const { path: pathNode } = this.args

    if (this.stat && this.stat.isFile()) {
      throw new ScriptError(
        `Not removing existing file with the name '${this.expandedPath}'`,
        pathNode
      )
    }

    await this.fs.remove(this.expandedPath)
  }

  result() {
    return { path: this.expandedPath }
  }
}
