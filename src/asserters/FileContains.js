import fs from "fs-extra"
import util from "../util"
import { ScriptError } from "../ScriptError"

/*
Ensures that a text file contains specific contents.

Example:

{
  assert: "FileContains",
  with: {
    path: <string>,
    position: "before|after|over"
    regex: "<string>"
    contents: <string>
  }
}
*/

export class FileContains {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.expandStringNode = container.expandStringNode
  }

  async assert(assertNode) {
    const withNode = assertNode.value.with
    const {
      path: pathNode,
      position: positionNode,
      regex: regexNode,
      contents: contentsNode,
    } = withNode.value

    if (!pathNode || pathNode.type !== "string") {
      throw new ScriptError(
        "'path' must be supplied and be a string",
        pathNode || withNode
      )
    }

    this.expandedPath = this.expandStringNode(pathNode)

    if (regexNode) {
      if (regexNode.type !== "string") {
        throw new ScriptError("'regex' must be a string", regexNode)
      }

      try {
        this.regExp = new RegExp(this.expandStringNode(regexNode), "gm")
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
        this.position !== "after"
      ) {
        throw new ScriptError(
          "'position' must be 'before', 'after' or 'over'",
          positionNode
        )
      }

      if (
        (this.position === "before" || this.position === "after") &&
        !regexNode
      ) {
        throw new ScriptError(
          "A 'regex' node must be provided with 'before' and 'after'",
          positionNode
        )
      }
    } else {
      this.position = "over"
    }

    if (!contentsNode || contentsNode.type !== "string") {
      throw new ScriptError(
        "'contents' must be supplied and be a string",
        contentsNode || withNode
      )
    }

    this.expandedContents = this.expandStringNode(contentsNode)

    const pathInfo = await this.util.pathInfo(this.expandedPath)

    if (!pathInfo.getAccess().isReadWrite()) {
      throw new ScriptError(
        `${this.expandedPath} cannot be read and written`,
        pathNode
      )
    }

    this.fileContents = await this.fs.readFile(this.expandedPath, {
      encoding: "utf8",
    })

    let match = null

    switch (this.position) {
      case "before":
        match = this.regExp.exec(this.fileContents)
        if (
          match &&
          this.fileContents.substring(
            match.index - this.expandedContents.length,
            match.index
          ) === this.expandedContents
        ) {
          // Desired content is after the before regex
          return true
        }
        break
      case "after":
        match = this.regExp.exec(this.fileContents)
        if (
          match &&
          this.fileContents.substring(
            this.regExp.lastIndex,
            this.regExp.lastIndex + this.expandedContents.length
          ) === this.expandedContents
        ) {
          // Desired content is before the regex
          return true
        }
        break
      case "over":
        if (this.fileContents.includes(this.expandedContents)) {
          // Desired content is in file
          return true
        }

        if (this.regExp) {
          match = this.regExp.exec(this.fileContents)
        }
        break
    }

    if (this.regExp) {
      if (!match) {
        throw new ScriptError(
          `Match not found for '${regexNode.value}'`,
          regexNode
        )
      } else {
        this.firstIndex = match.index
        this.lastIndex = this.regExp.lastIndex
      }
    } else {
      this.firstIndex = 0
      this.lastIndex = this.fileContents.length
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
      default:
        contents =
          this.fileContents.substring(0, this.firstIndex) +
          this.expandedContents +
          this.fileContents.substring(this.lastIndex)
        break
    }

    await this.fs.outputFile(this.expandedPath, contents)
  }

  result() {
    return { path: this.expandedPath, contents: this.expandedContents }
  }
}
