import fs from "fs-extra"
import path from "path"
import * as util from "./util"

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
      if (
        !(await util.fileExists(this.fs, args.fromPath)) ||
        !(await util.fileExists(this.fs, args.toPath))
      ) {
        return false
      }

      const fromDigest = await util.generateDigestFromFile(
        this.fs,
        args.fromPath
      )
      const toDigest = await util.generateDigestFromFile(this.fs, args.toPath)

      return fromDigest === toDigest
    } catch (e) {
      return false
    }
  }

  async actualize(args) {
    const toPathDir = path.dirname(args.toPath)

    if (!(await util.dirExists(this.fs, toPathDir))) {
      await this.fs.ensureDir(toPathDir)
    }

    await this.fs.copy(args.fromPath, args.toPath)
  }
}
