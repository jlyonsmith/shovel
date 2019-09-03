import crypto from "crypto"

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
        userName: fields[0],
        password: fields[1],
        uid: parseInt(fields[2]),
        gid: parseInt(fields[3]),
        name: fields[4],
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
        groupName: fields[0],
        password: fields[1],
        gid: parseInt(fields[2]),
        users: fields[3] ? fields[3].split(",") : [],
      }
    })
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

  let output = ""
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
          const s = stripAnsiEscapes(data.toString()).trim()

          if (options.password && firstLine) {
            // Password will be output to first line if supplied
            firstLine = false
            return
          } else if (
            (options.logError && s.startsWith("error:")) ||
            s.startsWith("warning:")
          ) {
            options.logError(s)
          } else if (/^\d+$/.test(s)) {
            exitCode = parseInt(s)
            return
          } else if (/^v?\d+\.\d+\.\d+/.test(s)) {
            // Version numbers
            output += s
          } else if (s.startsWith("/")) {
            // Paths
            output += s
          } else if (options.log && s.startsWith("{")) {
            // Log output as we go otherwise we keep the user guessing about what's happening
            for (const line of s.split("\n")) {
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
