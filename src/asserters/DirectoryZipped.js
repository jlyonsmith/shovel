import fs from "fs-extra"
import yazl from "yazl"
import * as util from "../util"
import path from "path"
import { Minimatch } from "minimatch"

/*
Checks and ensures that one or more files are in .zip file

Example:

    {
      assert: "DirectoryZipped",
      with: {
        zip: <string>,
        from: <string>,
        globs: <array>,
      },
    }
*/

export class DirectoryZipped {
  constructor(container) {
    this.fs = container.fs || fs
    this.util = container.util || util
    this.yazl = container.yazl || yazl
    this.newScriptError = container.newScriptError
    this.expandStringNode = container.expandStringNode
    this.withNode = container.withNode
  }

  async assert(args) {
    this.args = args

    const { zip: zipPathNode, from: fromPathNode, globs: globsNode } = args

    if (!zipPathNode || zipPathNode.type !== "string") {
      throw this.newScriptError(
        "'zip' must be supplied and be a string",
        zipPathNode || this.withNode
      )
    }

    if (!fromPathNode || zipPathNode.type !== "string") {
      throw this.newScriptError(
        "'from' must be supplied and be a string",
        fromPathNode || this.withNode
      )
    }

    if (!globsNode || globsNode.type !== "array") {
      throw this.newScriptError(
        "'globs' must be supplied and be an array",
        globsNode || this.withNode
      )
    }

    this.matchers = []

    for (const globNode of globsNode.value) {
      if (globNode.type !== "string") {
        throw this.newScriptError("glob must be a string", globNode)
      }

      try {
        this.matchers.push(new Minimatch(globNode.value))
      } catch (e) {
        throw this.newScriptError(
          `Glob '${globNode.value}' could not be parsed`,
          globNode
        )
      }
    }

    this.expandedZipPath = this.expandStringNode(zipPathNode)
    this.expandedFromPath = this.expandStringNode(fromPathNode)

    if (!(await this.util.dirExists(this.fs, this.expandedFromPath))) {
      throw this.newScriptError(
        `From directory ${this.expandedFromPath} does not exist`,
        globsNode
      )
    }

    // TODO: Create a list of all the files that should be zipped
    this.files = []

    if (!(await this.util.fileExists(this.fs, this.expandedZipPath))) {
      // TODO: We have to check if the zip is the same and if not we delete it in the rectify
      return true
    }

    return false
  }

  async rectify() {
    let zipFile = null

    // TODO: Delete the zip if it exists
    // TODO: Zip the files
  }

  result() {
    return {
      zip: this.expandedZipPath,
      from: this.expandedFromPath,
      globs: this.matchers.map((matcher) => matcher.pattern),
      files: this.files,
    }
  }
}
