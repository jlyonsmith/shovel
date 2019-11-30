import fs from "fs-extra"
import tar from "tar"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"

/*
Ensures that an archive has been unpacked to a directory

Example:

    {
      assert: "DirectoryUnarchived",
      with: {
        archive: "${tarPath}",
        directory: "./xyz",
      },
    }
*/

export class DirectoryUnarchived {
  constructor(container) {
    this.fs = container.fs || fs
    this.tar = container.tar || tar
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { archive: archiveNode, directory: directoryNode } = withNode.value

    if (!archiveNode || archiveNode.type !== "string") {
      throw new ScriptError(
        "'archive' must be supplied and be a string",
        archiveNode || withNode
      )
    }

    if (!directoryNode || directoryNode.type !== "string") {
      throw new ScriptError(
        "'to' must be supplied and be a string",
        directoryNode || withNode
      )
    }

    this.expandedArchive = this.expandStringNode(archiveNode)
    this.expandedDirectory = this.expandStringNode(directoryNode)

    const archivePathInfo = await this.util.pathInfo(this.expandedArchive)

    if (archivePathInfo.access[0] !== "r") {
      throw new ScriptError(
        `Archive file ${this.expandedArchive} does not exist or is not readable`,
        archiveNode
      )
    }

    const dirPathInfo = await this.util.pathInfo(this.expandedDirectory)

    if (!dirPathInfo.getAccess().isReadWrite()) {
      throw new ScriptError(
        `Directory ${this.expandedDirectory} does not exist or is not readable and writable`,
        directoryNode
      )
    }

    await tar.t({
      file: this.expandedArchive,
      noResume: true,
      onentry: (entry) => {
        const fullPath = path.join(this.expandedDirectory, entry.path)

        this.util
          .pathInfo(fullPath)
          .then((info) => {
            // TODO: Compare size, uid, gid, mode
            entry.resume()
          })
          .catch((error) => {
            throw new ScriptError(
              `Error reading archive. ${e.message}`,
              archiveNode
            )
          })
      },
    })

    return true
  }

  async rectify() {
    // TODO: Expand the archive into the directory
  }

  result() {
    return { archive: this.expandedArchive, directory: this.expandedDirectory }
  }
}
