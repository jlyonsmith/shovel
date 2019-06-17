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
    this.stats = null
  }

  async assert(args) {
    try {
      this.stats = await this.fs.lstat(args.path)
      return !this.stats.isDirectory()
    } catch (e) {
      return true
    }
  }

  async actualize(args) {
    if (this.stats && this.stats.isFile()) {
      throw new Error(`Not removing existing file with the name '${args.path}'`)
    }

    await this.fs.remove(args.path)
  }
}
