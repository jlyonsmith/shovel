import fs from "fs-extra"

/*
Checks and ensures that a directory exists.

Example:

{
  assert: "directoryExists",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryExistsAsserter {
  async assert(args) {
    try {
      return (await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return false
    }
  }

  async run(args) {
    try {
<<<<<<< HEAD
      await this.fs.ensureDir(args.path)
=======
      await fs.mkdir(args.path)
>>>>>>> 749cf5b7d0730b996f2835e9517b21d4afdf754d
      return true
    } catch (error) {
      return false
    }
  }
}
