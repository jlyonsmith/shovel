import crypto from "crypto"
import { ScriptError } from "./ScriptError"

export const generateDigestFromFile = (fs, path) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256")
    const rs = fs.createReadStream(path)

    rs.on("error", reject)
    rs.on("data", (chunk) => hash.update(chunk))
    rs.on("end", () => resolve(hash.digest("hex")))
  })

export const generateDigest = (data) => {
  const hash = crypto.createHash("sha256")
  hash.update(data)
  return hash.digest("hex")
}

export const fileExists = async (fs, path) => {
  try {
    return (await fs.lstat(path)).isFile()
  } catch (e) {
    return false
  }
}

export const dirExists = async (fs, path) => {
  try {
    return (await fs.lstat(path)).isDirectory()
  } catch (e) {
    return false
  }
}

export const pipeToPromise = (readable, writeable) => {
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

export const runningAsRoot = (os) => os.userInfo().uid === 0

export const getUsers = async (fs) => {
  const passwd = await fs.readFile("/etc/passwd", { encoding: "utf8" })

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

export const getGroups = async (fs) => {
  const groups = await fs.readFile("/etc/group", { encoding: "utf8" })

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

export const parseOwnerNode = (users, groups, ownerNode) => {
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

export const parseModeNode = (modeNode) => {
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
        (s[0] === "r" ? 4 : 0) | (s[1] === "w" ? 2 : 0) | (s[2] === "x" ? 1 : 0)
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
      throw new ScriptError(`'mode' flags must be specified`, node)
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

/*
  Run a command on the remote system. Options are:

 {
    noThrow: boolean    // Do not throw on bad exit code
    log: boolean  // Send script output on STDOUT directly to this.log
    sudo: boolean       // Run this command under sudo
    password: string    // Password (if needed for sudo)
 }
*/
export const runRemoteCommand = async (ssh, command, options = {}) => {
  // From https://stackoverflow.com/a/29497680/576235
  const ansiEscapeRegex = new RegExp(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  )
  const stripAnsiEscapes = (s) => s.replace(ansiEscapeRegex, "")

  const output = []
  let firstLine = true
  let exitCode = 0

  try {
    const commandLine =
      (options.cwd ? `cd ${options.cwd} 1> /dev/null 2> /dev/null;` : "") +
      (options.sudo ? "sudo " : "") +
      command +
      "; echo $?"
    const socket = await ssh.spawn(commandLine, null, {
      // Always allocate a pseudo-TTY. Unfortunately this merges STDOUT & STDERR
      // but different apps use those randomly anyway, so we might as
      // well merge them and identify the output with pattern matches.
      pty: true,
    })

    if (options.debug) {
      console.log(commandLine)
    }

    if (options.password) {
      socket.write(options.password + "\n")
      socket.end()
    }

    await new Promise((resolve, reject) => {
      socket
        .on("close", resolve)
        .on("error", reject)
        // We have to read data or the socket will block
        .on("data", (data) => {
          let lines = stripAnsiEscapes(data.toString()).match(
            /^.*((\r\n|\n|\r)|$)/gm
          )

          lines = lines.map((line) => line.trim())

          for (const line of lines) {
            if (options.password && firstLine) {
              // Password will be output to first line if supplied
              firstLine = false
            } else if (!line) {
              continue
            } else if (
              (options.logError && line.startsWith("error:")) ||
              line.startsWith("warning:")
            ) {
              options.logError(line)
            } else if (/^\d+$/.test(line)) {
              exitCode = parseInt(line)
            } else if (/^v?\d+\.\d+\.\d+/.test(line)) {
              // Version numbers
              output.push(line)
            } else if (line.startsWith("/")) {
              // Paths
              output.push(line)
            } else if (options.log && line.startsWith("{")) {
              options.log(line)
            }
          }
        })
    })
  } catch (error) {
    throw new Error(`Failed to run command '${command}'`)
  }

  if (!options.noThrow && exitCode !== 0) {
    throw new Error(`Command '${command}' returned exit code ${exitCode}`)
  }

  return { exitCode, output }
}
