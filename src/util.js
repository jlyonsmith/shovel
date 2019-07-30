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
  let stderr = ""
  let stdout = ""
  // From https://stackoverflow.com/a/29497680/576235
  const ansiEscapeRegex = new RegExp(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g
  )
  const stripAnsiEscapes = (s) => s.replace(ansiEscapeRegex, "")

  try {
    const commandLine =
      (options.cwd ? `cd ${options.cwd} 1> /dev/null 2> /dev/null;` : "") +
      (options.sudo ? "sudo " : "") +
      command +
      "; echo $? 1>&2"
    const socket = await ssh.spawn(commandLine, null, {
      pty: !!options.password,
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

          // If using a pseudo-TTY catch stderr here
          if (
            options.password &&
            (s.startsWith("error:") ||
            s.startsWith("warning:") ||
            /^v?\d+\.\d+\.\d+/.test(s) || // Version numbers
              /^\d+$/.test(s)) // Exit codes
          ) {
            stderr += s
            return
          }

          stdout += s

          if (options.log && s.startsWith("{")) {
            // Log output as we go otherwise we keep the user guessing about what's happening
            for (const line of s.split("\n")) {
              options.log(line)
            }
          }
        })
        .stderr.on("data", (data) => {
          const s = stripAnsiEscapes(data.toString())
          stderr += s
        })
    })
  } catch (error) {
    throw new Error(`Failed to run command '${command}'`)
  }

  let exitCode = 0

  // Be extra careful about grabbing the exit code digits
  // In case the script generates noise to STDERR.
  if (stderr) {
    let index = stderr.length - 1

    if (stderr[index] === "\n") {
      index -= 1
    }

    if (stderr[index] === "\r") {
      index -= 1
    }

    const endIndex = index + 1

    while (index >= 0 && stderr[index] >= "0" && stderr[index] <= "9") {
      index -= 1
    }

    index += 1

    if (index < endIndex) {
      exitCode = parseInt(stderr.substring(index, endIndex))
      stderr = stderr.substring(0, index).trim()
    }
  }

  if (!options.noThrow && exitCode !== 0) {
    throw new Error(`Command '${command}' returned exit code ${exitCode}`)
  }

  if (exitCode !== 0 && options.logError) {
    options.logError(stderr)
  }

  return { exitCode, stdout, stderr }
}
