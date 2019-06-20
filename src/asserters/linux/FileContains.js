import fs from "fs-extra"
import { generateDigestFromFile, generateDigest } from "./util"

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
  }

  async assert(args) {
    try {
      const pathDigest = await generateDigestFromFile(this.fs, args.path)
      const contentsDigest = generateDigest(args.contents)

      return pathDigest === contentsDigest
    } catch (e) {
      return false
    }
  }

  async actualize(args) {
    await this.fs.outputFile(args.path, args.contents)
  }
}
