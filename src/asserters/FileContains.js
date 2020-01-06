import fs from "fs-extra"
import util from "../util"
import { ScriptError } from "../ScriptError"

export class FileContains {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.interpolator = container.interpolator
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      file: fileNode,
      position: positionNode,
      regex: regexNode,
      contents: contentsNode,
    } = withNode.value

    if (!fileNode || fileNode.type !== "string") {
      throw new ScriptError(
        "'file' must be supplied and be a string",
        fileNode || withNode
      )
    }

    this.expandedPath = this.interpolator(fileNode)

    if (regexNode) {
      if (regexNode.type !== "string") {
        throw new ScriptError("'regex' must be a string", regexNode)
      }

      try {
        this.regExp = new RegExp(this.interpolator(regexNode), "gm")
      } catch (e) {
        throw new ScriptError(
          `Unable to parse regular expression. ${e.message}`,
          regexNode
        )
      }
    }

    if (positionNode) {
      if (positionNode.type !== "string") {
        throw new ScriptError("'position' node must be a string", positionNode)
      }

      this.position = positionNode.value

      if (
        this.position !== "over" &&
        this.position !== "before" &&
        this.position !== "after" &&
        this.position !== "all"
      ) {
        throw new ScriptError(
          "'position' must be 'before', 'after', 'over' or 'all'",
          positionNode
        )
      }

      if (
        (this.position === "before" ||
          this.position === "after" ||
          this.position === "over") &&
        !regexNode
      ) {
        throw new ScriptError(
          "A 'regex' node must be provided with 'before', 'after' and 'over'",
          positionNode
        )
      }
    } else {
      this.position = "all"
    }

    if (!contentsNode || contentsNode.type !== "string") {
      throw new ScriptError(
        "'contents' must be supplied and be a string",
        contentsNode || withNode
      )
    }

    this.expandedContents = this.interpolator(contentsNode)

    const pathInfo = await this.util.pathInfo(this.expandedPath)

    if (!pathInfo.getAccess().isReadWrite()) {
      throw new ScriptError(
        `${this.expandedPath} cannot be read and written`,
        fileNode
      )
    }

    this.fileContents = await this.fs.readFile(this.expandedPath, {
      encoding: "utf8",
    })

    let match = null

    switch (this.position) {
      case "before":
        match = this.regExp.exec(this.fileContents)

        if (!match) {
          throw new ScriptError(
            `Match not found for '${regexNode.value}'`,
            regexNode
          )
        }

        if (
          this.fileContents.substring(
            match.index - this.expandedContents.length,
            match.index
          ) === this.expandedContents
        ) {
          // Desired content is after the before regex
          return true
        }

        this.firstIndex = match.index
        this.lastIndex = this.regExp.lastIndex
        break
      case "after":
        match = this.regExp.exec(this.fileContents)

        if (!match) {
          throw new ScriptError(
            `Match not found for '${regexNode.value}'`,
            regexNode
          )
        }

        if (
          this.fileContents.substring(
            this.regExp.lastIndex,
            this.regExp.lastIndex + this.expandedContents.length
          ) === this.expandedContents
        ) {
          // Desired content is before the regex
          return true
        }

        this.firstIndex = match.index
        this.lastIndex = this.regExp.lastIndex
        break
      case "over":
        if (this.fileContents.includes(this.expandedContents)) {
          // Desired content is in file
          return true
        }

        match = this.regExp.exec(this.fileContents)

        if (match) {
          this.firstIndex = match.index
          this.lastIndex = this.regExp.lastIndex
        } else {
          this.firstIndex = this.lastIndex = this.fileContents.length
        }

        break
      case "all":
        if (this.fileContents === this.expandedContents) {
          return true
        }
        break
    }

    return false
  }

  async rectify() {
    let contents = null

    switch (this.position) {
      case "before":
        contents =
          this.fileContents.substring(0, this.firstIndex) +
          this.expandedContents +
          this.fileContents.substring(this.firstIndex)
        break
      case "after":
        contents =
          this.fileContents.substring(0, this.lastIndex) +
          this.expandedContents +
          this.fileContents.substring(this.lastIndex)
        break
      case "over":
        contents =
          this.fileContents.substring(0, this.firstIndex) +
          this.expandedContents +
          this.fileContents.substring(this.lastIndex)
        break
      case "all":
      default:
        contents = this.expandedContents
        break
    }

    await this.fs.outputFile(this.expandedPath, contents)
  }

  result() {
    return { file: this.expandedPath, contents: this.expandedContents }
  }
}
