import fs from "fs-extra"
import { generateDigestFromFile } from "./util"

/*
That a file was copied from one location to another.

Example:
    {
      assert: "FileCopied",
      with: {
        fromPath: <string>,
        toPath: <string>,
      },
    },
*/

export class FileCopied {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      const fromDigest = await generateDigestFromFile(this.fs, args.fromPath)
      const toDigest = await generateDigestFromFile(this.fs, args.toPath)

      console.log(fromDigest)
      console.log(toDigest)

      return fromDigest === toDigest
    } catch (e) {
      return false
    }
  }

  async actualize(args) {
    await this.fs.copy(args.fromPath, args.toPath)
  }
}
