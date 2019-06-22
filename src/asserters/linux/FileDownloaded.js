import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import * as util from "./util"

/*
Asserts that a file is downloaded. Uses SHA256 digest to verify proper file.

Example:

{
  assert: "FileDownloaded",
  with: {
        url: "https://sourcehost.com/linux_amd64.zip",
        digest: "658f4f3b305cd357a9501728b8a1dc5f...",
        toPath: "${destZipFile}",
  }
}
*/

export class FileDownloaded {
  constructor(container) {
    this.fs = container.fs || fs
    this.fetch = container.fetch || fetch
  }

  async assert(args) {
    try {
      this.toFileExists = await util.fileExists(this.fs, args.toPath)

      if (!this.toFileExists) {
        return false
      }

      const toFileDigest = await util.generateDigestFromFile(
        this.fs,
        args.toPath
      )

      return toFileDigest === args.digest
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    if (!this.toFileExists) {
      {
        const toDirPath = path.dirname(args.toPath)

        if (!(await util.dirExists(this.fs, toDirPath))) {
          await this.fs.ensureDir(toDirPath)
        }
      }
    } else {
      await this.fs.remove(args.toPath)
    }

    const result = await this.fetch(args.url)
    const writeable = this.fs.createWriteStream(args.toPath)

    await util.pipeToPromise(result.body, writeable)
  }
}
