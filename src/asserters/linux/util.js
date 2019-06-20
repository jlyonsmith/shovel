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
