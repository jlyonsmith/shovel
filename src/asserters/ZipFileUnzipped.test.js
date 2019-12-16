import { ZipFileUnzipped } from "./ZipFileUnzipped"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {
      lstat: jest.fn(async (path) => {
        switch (path) {
          case "outdir/filedir.txt":
          case "outdir/dir/":
          case "./outdir":
            return {
              isDirectory: jest.fn(() => true),
              isFile: jest.fn(() => false),
              size: 0,
            }
          case "outdir/dir/file.txt":
            return {
              isDirectory: jest.fn(() => false),
              isFile: jest.fn(() => true),
              size: 100,
            }
          default:
            throw new Error("ENOENT")
        }
      }),
      ensureDir: jest.fn(async (dirPath) => {
        expect(typeof dirPath).toBe("string")
      }),
    },
    util: {
      fileExists: async (path) => {
        switch (path) {
          case "./filesize.zip":
          case "./filedir.zip":
          case "./dirfile.zip":
          case "./somefile.zip":
          case "./filemissing.zip":
            return true
          default:
            return false
        }
      },
      dirExists: async (path) => {
        switch (path) {
          case "./outdir":
            return true
          default:
            return false
        }
      },
    },
    yauzl: {
      open: jest.fn(async (path) => {
        expect(typeof path).toBe("string")

        const openReadStream = async () =>
          new stream.Readable({
            read(size) {
              this.push("The quick brown fox jumps over the lazy dog\n")
              this.push(null)
            },
          })

        let entries = null

        switch (path) {
          default:
          case "./somefile.zip":
            entries = [
              { uncompressedSize: 0, fileName: "dir/" },
              {
                uncompressedSize: 100,
                fileName: "dir/file.txt",
                openReadStream,
              },
            ]
            break
          case "./filesize.zip":
            entries = [
              { uncompressedSize: 0, fileName: "dir/" },
              {
                uncompressedSize: 50,
                fileName: "dir/file.txt",
                openReadStream,
              },
            ]
            break
          case "./filedir.zip": // File is a directory
            entries = [
              {
                uncompressedSize: 50,
                fileName: "filedir.txt",
                openReadStream,
              },
            ]
            break
          case "./filemissing.zip":
            entries = [
              {
                uncompressedSize: 100,
                fileName: "notthere.txt",
                openReadStream,
              },
            ]
            break
        }

        expect(entries).not.toBeNull()

        return {
          close: jest.fn(async () => null),
          walkEntries: jest.fn(async (callback) => {
            // Assuming that callback returns a Promise
            await Promise.all(entries.map(callback))
          }),
        }
      }),
    },
  }

  const asserter = new ZipFileUnzipped(container)

  // With bad zip path
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // With bad toDirectory path
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "", toDirectory: 1 }))
  ).rejects.toThrow(ScriptError)

  // With file not present
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./missing.zip",
        toDirectory: "./outdir",
      })
    )
  ).rejects.toThrow(ScriptError)

  // With all files unzipped and the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./somefile.zip",
        toDirectory: "./outdir",
      })
    )
  ).resolves.toBe(true)

  // With output directory missing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./somefile.zip",
        toDirectory: "./notthere",
      })
    )
  ).resolves.toBe(false)

  // With a file missing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./filemissing.zip",
        toDirectory: "./outdir",
      })
    )
  ).resolves.toBe(false)

  // With a file as different size
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./filesize.zip",
        toDirectory: "./outdir",
      })
    )
  ).resolves.toBe(false)

  // With a file as a directory
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./filedir.zip",
        toDirectory: "./outdir",
      })
    )
  ).resolves.toBe(false)

  // With bad zip file
  container.yauzl.open = jest.fn(async () => {
    throw Error()
  })
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "./somefile.zip",
        toDirectory: "./outdir",
      })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = {
    fs: {
      ensureDir: jest.fn(async () => undefined),
      createWriteStream: jest.fn(async () => {
        return new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        })
      }),
    },
    util: {
      dirExists: async (path) => {
        switch (path) {
          case "/a":
            return false
          default:
            return true
        }
      },
      pipeToPromise: async (readable, writeable) => {},
    },
    yauzl: {
      open: jest.fn(async (path) => {
        const openReadStream = async () =>
          new stream.Readable({
            read(size) {
              this.push("The quick brown fox jumps over the lazy dog\n")
              this.push(null)
            },
          })

        let entries = [
          { uncompressedSize: 0, fileName: "a/" },
          {
            uncompressedSize: 100,
            fileName: "a/file.txt",
            openReadStream,
          },
          {
            uncompressedSize: 100,
            fileName: "b/file.txt",
            openReadStream,
          },
        ]

        return {
          close: jest.fn(async () => null),
          walkEntries: jest.fn(async (callback) => {
            // Assuming that callback returns a Promise
            await Promise.all(entries.map(callback))
          }),
        }
      }),
    },
  }
  const asserter = new ZipFileUnzipped(container)

  asserter.expandedFilePath = "/xyz.zip"
  asserter.expandedToPath = "/"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  // If zip file cannot be opened
  container.yauzl.open = jest.fn(async () => {
    throw new Error()
  })
  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new ZipFileUnzipped({})

  asserter.expandedFilePath = "blah.zip"
  asserter.expandedToPath = "file/"

  expect(asserter.result()).toEqual({
    file: asserter.expandedFilePath,
    toDirectory: asserter.expandedToPath,
  })
})
