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
    const modeString = (mode) =>
      (mode & 0o400 ? "r" : "-") +
      (mode & 0o200 ? "w" : "-") +
      (mode & 0o100 ? "x" : "-") +
      (mode & 0o040 ? "r" : "-") +
      (mode & 0o020 ? "w" : "-") +
      (mode & 0o010 ? "x" : "-") +
      (mode & 0o004 ? "r" : "-") +
      (mode & 0o002 ? "w" : "-") +
      (mode & 0o001 ? "x" : "-")
    const accessString = (mode) =>
      (mode & 4 ? "r" : "-") + (mode & 2 ? "w" : "-")

    try {
      stat = await this.fs.lstat(pathName)
    } catch (e) {
      return { type: "-", access: "--" }
    }

    const info = {}

    info.type = stat.isFile() ? "f" : stat.isDirectory() ? "d" : "o"
    info.size = stat.size
    info.uid = stat.uid
    info.gid = stat.gid
    info.mode = modeString(stat.mode)

    const euid = this.process.geteuid()

    if (euid === stat.uid) {
      info.access = accessString(stat.mode >> 6)
      return info
    }

    const egid = this.process.getegid()
    const groups = this.process.getgroups()

    if (groups.includes(stat.gid)) {
      info.access = accessString(stat.mode >> 3)
      return info
    }

    info.access = accessString(stat.mode)
    return info
  }

  async fileExists(filePath) {
    try {
      return (await this.fs.lstat(filePath)).isFile()
    } catch (e) {
      return false
    }
  }

  async dirExists(pathName) {
    try {
      return (await this.fs.lstat(pathName)).isDirectory()
    } catch (e) {
      return false
    }
  }

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

  parseOwnerNode(users, groups, ownerNode) {
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

  parseModeNode(modeNode) {
    let mode = 0o644 // Default to -rw-r--r-- mode

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
