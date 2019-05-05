const fs = require("fs")
const fsx = require("fs-extra")
const http = require("http")
const https = require("https")
const request = require("request")

/*
Asserts that a file is downloaded.
Uses checksum to verify proper file.

Example:

{
  assert: "FileDownloaded",
  with: {
        url: "https://sourcehost.com/linux_amd64.zip",
        checksum: "658f4f3b305cd357a9501728b8a1dc5f",
        checksumType: "etag",
        toFile: "${destZipFile}",
  }
}
*/

class FileDownloadedAsserter {
  constructor(container) {
    this.fs = container.fs || fs
  }

  async assert(args) {
    try {
      const url = args.url || ""
      const checksum = args.checksum || null
      const checksumType = args.checksumType || "md5"
      const toFile = args.toFile || ""
      console.log(
        ` assert file is downloaded url: ${url} checksum: ${checksum} checksumType: ${checksumType} toFile: ${toFile}`
      )

      const fileExists = await this.doesFileExist(toFile)
      if (fileExists) {
        console.log(`file exists. test checksum.`)
        const checksumMatches = await this.testChecksum(
          url,
          toFile,
          checksum,
          checksumType
        )
        return checksumMatches
      } else {
        console.log(`File ${toFile} does not exist.`)
        return false
      }
    } catch (error) {
      console.log(`Error running testing assertion: ${error}`)
      return false
    }
  }

  async doesFileExist(filepath) {
    try {
      return (await fsx.lstat(filepath)).isFile()
    } catch (error) {
      return false
    }
  }

  async testChecksum(url, toFile, checksum, checksumType) {
    const headers = await this.readSourceHeaders(url)
    const sourceChecksum = this.extractChecksum(headers, checksumType)
    const match = checksum == sourceChecksum
    console.log(
      `Checksum expected: ${checksum} actual: ${sourceChecksum} match: ${match} `
    )

    return match
  }

  extractChecksum(headers, checksumType) {
    let checksum = ""
    switch (checksumType) {
      case "etag":
        checksum = headers.etag
        checksum = checksum.replace(/"/g, "")
        break
    }
    return checksum
  }

  async readSourceHeaders(url) {
    return new Promise(function(resolve, reject) {
      request(url, { method: "HEAD" }, function(err, res, body) {
        if (err) {
          console.log(JSON.stringify(err))
          reject(err)
        }
        resolve(res.headers)
      })
    })
  }

  async run(args) {
    const url = args.url || ""
    const toFile = args.toFile || ""
    try {
      console.log(
        `Run FileDownloadedAsserter url: ${args.url} toFile: ${args.toFile}`
      )
      const success = await this.httpsDownloadFile(url, toFile)
      return success
    } catch (error) {
      console.log(`Error downloading file: ${JSON.stringify(error)}`)
      return false
    }
  }

  async httpsDownloadFile(url, toFile) {
    const file = fs.createWriteStream(toFile)
    const request = https.get(url, function(response) {
      console.log("Download Started...")
      response.pipe(file)
      file.on("finish", function() {
        console.log('Download complete"')
        file.close()
        return true
      })
    })
  }
}

module.exports = FileDownloadedAsserter
