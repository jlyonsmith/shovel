import { DirectoryZipped } from "./DirectoryZipped"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { PathInfo } from "../util"

test("assert", async () => {
  let container = {
    interpolator: (node) => node.value,
    readdirp: (path, options) => {
      const generateEntries = async function*(entries) {
        for (const entry of entries) {
          yield entry
        }
      }

      return generateEntries([
        { path: "a.txt", stats: { size: 50 } },
        { path: "x/b.txt", stats: { size: 150 } },
        { path: "x/y/c.txt", stats: { size: 250 } },
      ])
    },
    util: {
      pathInfo: async (path) => {
        switch (path) {
          case "./somefile.zip":
            return new PathInfo({
              isFile: () => true,
              isDirectory: () => false,
            })
          case "./fromdir":
            return new PathInfo({
              isFile: () => false,
              isDirectory: () => true,
            })
          default:
            return new PathInfo()
        }
      },
    },
    yauzl: {
      open: jest.fn(async (path) => {
        expect(typeof path).toBe("string")

        let entries = null

        switch (path) {
          default:
          case "./somefile.zip":
            entries = [
              {
                uncompressedSize: 50,
                fileName: "a.txt",
              },
              { uncompressedSize: 0, fileName: "x/" },
              {
                uncompressedSize: 0,
                fileName: "x/",
              },
              {
                uncompressedSize: 150,
                fileName: "x/b.txt",
              },
              { uncompressedSize: 0, fileName: "x/y/" },
              {
                uncompressedSize: 250,
                fileName: "x/y/c.txt",
              },
            ]
            break
          case "./withfilemissing.zip":
            entries = [
              { uncompressedSize: 0, fileName: "x/" },
              {
                uncompressedSize: 150,
                fileName: "x/b.txt",
              },
            ]
            break
        }

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
  const asserter = new DirectoryZipped(container)

  // Bad zip arg
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { zipFile: 1 }))
  ).rejects.toThrow(ScriptError)

  // Bad from arg
  await expect(
    asserter.assert(createAssertNode(asserter, { zipFile: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { zipFile: "", directory: 1 }))
  ).rejects.toThrow(ScriptError)

  // Bad globs arg
  await expect(
    asserter.assert(
      createAssertNode(asserter, { zipFile: "", directory: "", globs: 1 })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { zipFile: "", directory: "", globs: [1] })
    )
  ).rejects.toThrow(ScriptError)

  // With from directory not present or inaccessible
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zipFile: "./somefile.zip",
        directory: "./missing",
        globs: ["*"],
      })
    )
  ).rejects.toThrowError(ScriptError)

  // With zip not present
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zipFile: "./otherfile.zip",
        directory: "./fromdir",
        globs: ["*"],
      })
    )
  ).resolves.toBe(false)

  // With all files zipped and the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zipFile: "./somefile.zip",
        directory: "./fromdir",
      })
    )
  ).resolves.toBe(true)

  // With a file missing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zipFile: "./withfilemissing.zip",
        directory: "./fromdir",
      })
    )
  ).resolves.toBe(false)

  // With broken zip file
  container.yauzl.open = async () => {
    throw new Error()
  }
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zipFile: "./somefile.zip",
        directory: "./fromdir",
      })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = {
    util: {
      pipeToPromise: async (readable, writeable) => undefined,
    },
    fs: {
      createWriteStream: jest.fn(async () => {
        return new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        })
      }),
      remove: jest.fn(async () => undefined),
    },
    yazl: {
      ZipFile: class {
        constructor() {
          this.outputStream = new stream.Readable({
            read(size) {
              this.push("The quick brown fox jumps over the lazy dog\n")
              this.push(null)
            },
          })
        }
        addFile(path) {}
        end() {}
      },
    },
  }
  const asserter = new DirectoryZipped(container)

  asserter.expandedDirectory = "/from"
  asserter.expandedZipFile = "a.zip"
  asserter.zipFileExists = true
  asserter.files = ["a.txt"]

  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.zipFileExists = false

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new DirectoryZipped({})

  asserter.expandedZipFile = "/a.zip"
  asserter.expandedDirectory = "/from"
  asserter.globs = "*"
  asserter.files = ["a.txt"]

  expect(asserter.result()).toEqual({
    zipFile: asserter.expandedZipFile,
    directory: asserter.expandedDirectory,
    globs: asserter.globs,
    files: asserter.files,
  })
})
