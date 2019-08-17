import { DirectoryUnzipped } from "./DirectoryUnzipped"
import stream from "stream"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("string")
      return new Error(message)
    },
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
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
      createWriteStream: jest.fn(async (fileName) => {
        expect(typeof fileName).toBe("string")

        return new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        })
      }),
    },
    util: {
      fileExists: async (fs, path) => {
        expect(typeof path).toBe("string")
        expect(fs).not.toBeNull()
        expect(typeof fs).toBe("object")

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
      dirExists: async (fs, path) => {
        expect(typeof path).toBe("string")
        expect(fs).not.toBeNull()
        expect(typeof fs).toBe("object")

        switch (path) {
          case "./outdir":
            return true
          default:
            return false
        }
      },
      pipeToPromise: async (readable, writeable) => {
        expect(typeof readable).toBe("object")
        expect(typeof writeable).toBe("object")
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
})

test("With zip file not present", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./missing.zip" },
      to: { type: "string", value: "./outdir" },
    })
  ).rejects.toThrow()
})

test("With all files unzipped and the same", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./somefile.zip" },
      to: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(true)
})

test("With output directory missing", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./somefile.zip" },
      to: { type: "string", value: "./notthere" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file missing", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./filemissing.zip" },
      to: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file as different size", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./filesize.zip" },
      to: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file as a directory", async () => {
  const asserter = new DirectoryUnzipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./filedir.zip" },
      to: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
