import { DirectoryZipped } from "./DirectoryZipped"
import stream from "stream"
import { createAssertNode } from "./testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    fs: {
      remove: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
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
    readdirp: (path, options) => {
      expect(typeof path).toBe("string")
      expect(typeof options).toBe("object")

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
      fileExists: async (fs, path) => {
        expect(typeof path).toBe("string")
        expect(fs).not.toBeNull()
        expect(typeof fs).toBe("object")

        switch (path) {
          case "./somefile.zip":
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
          case "./fromdir":
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
})

test("With from directory not present", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./somefile.zip",
        from: "./missing",
        globs: ["*"],
      })
    )
  ).rejects.toThrowError(/directory .* does not exist/)
})

test("With missing zip argument", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        from: "./fromdir",
        globs: ["*"],
      })
    )
  ).rejects.toThrowError("'zip' must be supplied")
})

test("With missing from argument", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./somefile.zip",
        globs: ["*"],
      })
    )
  ).rejects.toThrowError("'from' must be supplied")
})

test("With missing globs argument", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./missing.zip",
        from: "./fromdir",
      })
    )
  ).resolves.toBe(false)
})

test("With all files zipped and the same", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./somefile.zip",
        from: "./fromdir",
        globs: ["*"],
      })
    )
  ).resolves.toBe(true)
})

test("With a file missing", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./withfilemissing.zip",
        from: "./fromdir",
      })
    )
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With zip file missing", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        zip: "./missing.zip",
        from: "./fromdir",
      })
    )
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
