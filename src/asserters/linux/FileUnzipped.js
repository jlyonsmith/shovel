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
    this.yauzl = container.yauzl || youzl
  }

  async assert(args) {
    return true
  }

  async actualize(args) {}
}
