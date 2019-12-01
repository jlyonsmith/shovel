import fs from "fs-extra"
import tar from "tar"
import util from "../util"
import path from "path"
import { ScriptError } from "../ScriptError"
import { resolve } from "dns"

export class TarFileExtracted {
  constructor(container) {
    this.fs = container.fs || fs
    this.tar = container.tar || tar
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const { file: fileNode, toDirectory: toDirectoryNode } = withNode.value

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    if (!toDirectoryNode || toDirectoryNode.type !== "string") {
      throw new ScriptError(
        "'toDirectory' must be supplied and be a string",
        toDirectoryNode || withNode
      )
    }

    this.expandedArchive = this.expandStringNode(fileNode)
    this.expandedDirectory = this.expandStringNode(toDirectoryNode)

    const filePathInfo = await this.util.pathInfo(this.expandedArchive)

    if (!filePathInfo.getAccess().isReadable()) {
      throw new ScriptError(
        `Archive file '${this.expandedArchive}' does not exist or is not readable`,
        fileNode
      )
    }

    const dirPathInfo = await this.util.pathInfo(this.expandedDirectory)

    if (!dirPathInfo.getAccess().isReadWrite()) {
      throw new ScriptError(
        `Directory '${this.expandedDirectory}' does not exist or is not readable and writable`,
        toDirectoryNode
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
                `Error reading file ${this.expandedArchive}. ${e.message}`,
                fileNode
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
    return { file: this.expandedArchive, toDirectory: this.expandedDirectory }
  }
}
