import fs from "fs-extra"

/*
Asserts and ensures that a directory is absent.

Example:

{
  assert: "directoryAbsent",
  with: {
    path: "/path/to/dir"
  }
}
*/

export class DirectoryAbsentAsserter {
  async assert(args) {
    try {
      return !(await fs.lstat(args.path)).isDirectory()
    } catch (error) {
      return true
    }
  }

  async run(args) {
    try {
<<<<<<< HEAD
      await this.fs.remove(args.path)
=======
      await fs.rmdir(args.path)
>>>>>>> 749cf5b7d0730b996f2835e9517b21d4afdf754d
      return true
    } catch (error) {
      return false
    }
  }
}
