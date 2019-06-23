import fs from "fs"
import yauzl from "yauzl-promise"

/*
Checks and ensures that a .zip file is unzipped to a directory.

Example:

    {
      assert: "FileUnzipped",
      with: {
        zipPath: "${consulZipPath}",
        toPath: "./xyz",
      },
    }
*/

export class FileUnzipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.yauzl = container.yauzl || yauzl
  }

  async assert(args) {
    this.args = args

    try {
      return true
    } catch (e) {
      return false
    }
  }

  async actualize() {}
}
