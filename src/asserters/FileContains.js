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
  }

  async assert(args) {
    this.args = args

    try {
      const pathDigest = await util.generateDigestFromFile(this.fs, args.path)
      const contentsDigest = util.generateDigest(args.contents)

      return pathDigest === contentsDigest
    } catch (e) {
      return false
    }
  }

  async actualize() {
    await this.fs.outputFile(this.args.path, this.args.contents)
  }
}
