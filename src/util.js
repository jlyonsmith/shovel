import crypto from "crypto"
import { ScriptError } from "./ScriptError"
import osInfo from "linux-os-info"
import fs from "fs-extra"
import os from "os"
import path from "path"

// From https://stackoverflow.com/a/29497680/576235
export const ansiEscapeRegex = new RegExp(
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
)

const modeFormat = (flags) =>
  (flags & 4 ? "r" : "-") +
  (flags & 2 ? "w" : "-") +
  (flags & 1 ? "x" : "-")

export class PathAccess {
  constructor(mode) {
    this.mode = mode & 7
  }

  toString() {
    return modeFormat(this.mode)
  }

  isReadable() {
    return !!(this.mode & 4)
  }
  isWriteable() {
    return !!(this.mode & 2)
  }
  isReadWrite() {
    return this.isReadable() && this.isWriteable()
  }
  isExecutable() {
    return !!(this.mode & 1)
  }
  isTraversable() {
    return this.isExecutable()
  }
}

export class PathInfo {
  constructor(stat, container) {
    if (!stat) {
      this.type = 0
      this.mode = 0
    } else {
      this.type = stat.isFile() ? 1 : stat.isDirectory() ? 2 : 3
      this.size = stat.size
      this.uid = stat.uid
      this.gid = stat.gid
      this.mode = stat.mode
    }

    this.process = (container && container.process) || process
  }

  toString() {
    if (this.type === 0) {
      return JSON.stringify({
        type: 0,
      })
    } else {
      return JSON.stringify({
        type: this.type,
        size: this.size,
        uid: this.uid,
        gid: this.gid,
        mode: this.mode,
      })
    }
  }

  isMissing() {
    return this.type === 0
  }

  isFile() {
    return this.type === 1
  }

  isDirectory() {
    return this.type === 2
  }

  isOther() {
    return this.type > 2
  }

  getAccess(uid, groups) {
    uid = uid === undefined ? this.process.geteuid() : uid

    if (uid === 0) {
      return new PathAccess(7)
    }

    if (uid === this.uid) {
      return new PathAccess(this.mode >> 6)
    }

    groups = groups === undefined ? this.process.getgroups() : groups

    if (groups.includes(this.gid)) {
      return new PathAccess(this.mode >> 3)
    }

    return new PathAccess(this.mode)
  }

  modeString() {
    return modeFormat(this.mode >> 6) + modeFormat(this.mode >> 3) + modeFormat(this.mode)
  }
}

export class Utility {
  constructor(container = {}) {
    this.fs = container.fs || fs
    this.os = container.os || os
    this.os.osInfo = container.osInfo || osInfo
    this.console = container.console || console
    this.process = container.process || process
  }

  generateDigestFromFile(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256")
      const rs = this.fs.createReadStream(filePath)

      rs.on("error", reject)
      rs.on("data", (chunk) => hash.update(chunk))
      rs.on("end", () => resolve(hash.digest("hex")))
    })
  }

  generateDigest(data) {
    const hash = crypto.createHash("sha256")

    hash.update(data)
    return hash.digest("hex")
  }

  async pathInfo(pathName) {
    let stat = null

    try {
      stat = await this.fs.lstat(pathName)
    } catch (e) {
      return new PathInfo()
    }

    return new PathInfo(stat)
  }

  // TODO: Remove in favor of pathInfo
  async fileExists(filePath) {
    try {
      return (await this.fs.lstat(filePath)).isFile()
    } catch (e) {
      return false
    }
  }

  // TODO: Remove in favor of pathInfo
  async dirExists(pathName) {
    try {
      return (await this.fs.lstat(pathName)).isDirectory()
    } catch (e) {
      return false
    }
  }

  // TODO: Remove in favor of pathInfo
  async canAccess(pathName) {
    try {
      await this.fs.access(pathName, fs.constants.W_OK | fs.constants.R_OK)
    } catch (e) {
      return false
    }
    return true
  }

  pipeToPromise(readable, writeable) {
    const promise = new Promise((resolve, reject) => {
      readable.on("error", (error) => {
        reject(error)
      })
      writeable.on("error", (error) => {
        reject(error)
      })
      writeable.on("finish", (file) => {
        resolve(file)
      })
    })
    readable.pipe(writeable)
    return promise
  }

  userInfo() {
    const info = this.os.userInfo({ encoding: "utf8" })

    return {
      name: info.username,
      uid: info.uid,
      gid: info.gid,
      shell: info.shell,
      homeDir: info.homedir,
    }
  }

  async osInfo() {
    const info = await this.os.osInfo()

    return {
      platform: info.platform,
      id: info.id,
      versionId: info.version_id,
    }
  }

  parsePort(s) {
    const port =
      typeof s === "string"
        ? parseInt(s)
        : typeof s === "number"
          ? s
          : undefined

    if (port && (port < 0 || port > 65535)) {
      throw new Error("Port must be a number between 0 and 65535")
    }

    return port
  }

  expandTilde(filePath) {
    if (filePath && typeof filePath === "string" && filePath[0] === "~") {
      return path.join(this.process.env.HOME, filePath.slice(1))
    } else {
      return filePath
    }
  }

  runningAsRoot() {
    return this.os.userInfo().uid === 0
  }

  async getUsers() {
    // TODO: Add /etc/shadow for disabled users?
    const passwd = await this.fs.readFile("/etc/passwd", { encoding: "utf8" })

    return passwd
      .split("\n")
      .filter((user) => user.length > 0 && user[0] !== "#")
      .map((user) => {
        const fields = user.split(":")
        return {
          name: fields[0],
          password: fields[1],
          uid: parseInt(fields[2]),
          gid: parseInt(fields[3]),
          comment: fields[4],
          homeDir: fields[5],
          shell: fields[6],
        }
      })
  }

  async getGroups() {
    const groups = await this.fs.readFile("/etc/group", { encoding: "utf8" })

    return groups
      .split("\n")
      .filter((user) => user.length > 0 && user[0] !== "#")
      .map((user) => {
        const fields = user.split(":")
        return {
          name: fields[0],
          password: fields[1],
          gid: parseInt(fields[2]),
          users: fields[3] ? fields[3].split(",") : [],
        }
      })
  }

  parseOwnerNode(ownerNode, users, groups) {
    let owner = {}

    if (ownerNode) {
      if (ownerNode.type !== "object") {
        throw new ScriptError("'owner' must be of type object", ownerNode)
      }

      const { user: userNode, group: groupNode } = ownerNode.value

      if (userNode) {
        if (userNode.type !== "string" && userNode.type !== "number") {
          throw new ScriptError(
            "'user' must be of type string or number",
            userNode
          )
        }

        const func =
          userNode.type === "string"
            ? (u) => u.name === userNode.value
            : (u) => u.uid === userNode.value
        const user = users.find(func)

        if (user === undefined) {
          throw new ScriptError(
            `'user' value '${userNode.value}' not valid`,
            userNode
          )
        }

        owner.uid = user.uid
      }

      if (groupNode) {
        if (groupNode.type !== "string" && groupNode.type !== "number") {
          throw new ScriptError(
            "'group' must be of type string or number",
            groupNode
          )
        }

        const func =
          groupNode.type === "string"
            ? (g) => g.name === groupNode.value
            : (g) => g.gid === groupNode.value
        const group = groups.find(func)

        if (group === undefined) {
          throw new ScriptError(
            `'group' value ${groupNode.value} not valid`,
            groupNode
          )
        }

        owner.gid = group.gid
      }
    }

    return owner
  }

  parseModeNode(modeNode, defaultMode = 0o644) {
    let mode = defaultMode

    const parsePerms = (node) => {
      const s = node.value

      if (
        node.type === "string" &&
        s.length === 3 &&
        (s[0] === "r" || s[0] === "-") &&
        (s[1] === "w" || s[1] === "-") &&
        (s[2] === "x" || s[2] === "-")
      ) {
        return (
          (s[0] === "r" ? 4 : 0) |
          (s[1] === "w" ? 2 : 0) |
          (s[2] === "x" ? 1 : 0)
        )
      } else {
        throw new ScriptError(
          `Mode must be a string in the order 'rwx', with a dash if a permission is not present`,
          node
        )
      }
    }

    if (modeNode) {
      if (modeNode.type !== "object") {
        throw new ScriptError(`'mode' flags must be specified`, modeNode)
      }

      const {
        user: userNode,
        group: groupNode,
        other: otherNode,
      } = modeNode.value

      mode = 0

      if (userNode) {
        mode |= parsePerms(userNode) << 6
      }

      if (groupNode) {
        mode |= parsePerms(groupNode) << 3
      }

      if (otherNode) {
        mode |= parsePerms(otherNode)
      }
    }

    return mode
  }
}

const util = new Utility()

export default util
