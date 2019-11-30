import fs from "fs-extra"
import tar from "tar"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"
import { resolve } from "dns"

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

    if (!archivePathInfo.getAccess().isReadable()) {
      throw new ScriptError(
        `Archive file '${this.expandedArchive}' does not exist or is not readable`,
        archiveNode
      )
    }

    const dirPathInfo = await this.util.pathInfo(this.expandedDirectory)

    if (!dirPathInfo.getAccess().isReadWrite()) {
      throw new ScriptError(
        `Directory '${this.expandedDirectory}' does not exist or is not readable and writable`,
        directoryNode
      )
    }

    const ok = await new Promise((resolve, reject) => {
      const readable = fs.createReadStream(this.expandedArchive)
      const writeable = new tar.Parse()

      writeable.on("entry", (entry) => {
        const fullPath = path.join(this.expandedDirectory, entry.path)

        this.util
          .pathInfo(fullPath)
          .then((info) => {
            if (info.size !== entry.size) {
              resolve(false)
              readable.destroy()
            } else {
              entry.resume()
            }
          })
          .catch((error) => {
            reject(
              new ScriptError(
                `Error reading archive ${this.expandedArchive}. ${e.message}`,
                archiveNode
              )
            )
          })
      })
      readable.on("close", () => resolve(true))
      readable.pipe(writeable)
    })

    return ok
  }

  async rectify() {
    await tar.x({ file: this.expandedArchive, cwd: this.expandedDirectory })
  }

  result() {
    return { archive: this.expandedArchive, directory: this.expandedDirectory }
  }
}
