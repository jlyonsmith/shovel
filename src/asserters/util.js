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
