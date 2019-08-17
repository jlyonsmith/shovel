import { DirectoryZipped } from "./DirectoryZipped"
import stream from "stream"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("object")
      return new Error(message)
    },
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
    fs: {
      lstat: jest.fn(async (path) => {
        switch (path) {
          case "./filesize.zip":
          case "./filedir.zip":
          case "./dirfile.zip":
          case "./somefile.zip":
          case "./filemissing.zip":
            return {
              isDirectory: jest.fn(() => false),
              isFile: jest.fn(() => true),
            }
            break
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
    yazl: {},
  }
})

test("With from directory not present", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./somefile.zip" },
      from: { type: "string", value: "./missing" },
      globs: { type: "array", value: [{ type: "string", value: "*" }] },
    })
  ).rejects.toThrowError(/directory .* does not exist/)
})

test("With missing zip", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert({
      from: { type: "string", value: "./missing" },
      globs: { type: "array", value: [{ type: "string", value: "*" }] },
    })
  ).rejects.toThrowError("'zip' must be supplied")
})

test("With missing from", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./somefile.zip" },
      globs: { type: "array", value: [{ type: "string", value: "*" }] },
    })
  ).rejects.toThrowError("'from' must be supplied")
})

test("With missing globs", async () => {
  const asserter = new DirectoryZipped(container)

  await expect(
    asserter.assert({
      zip: { type: "string", value: "./somefile.zip" },
      from: { type: "string", value: "./missing" },
    })
  ).rejects.toThrowError("'globs' must be supplied")
})

// test("With all files zipped and the same", async () => {
//   const asserter = new DirectoryZipped(container)

//   await expect(
//     asserter.assert({
//       zip: { type: "string", value: "./somefile.zip" },
//       from: { type: "string", value: "./fromdir" },
//       globs: { type: "array", value: [{ type: "string", value: "*" }] },
//     })
//   ).resolves.toBe(true)
// })

// test("With output directory missing", async () => {
//   const asserter = new DirectoryZipped(container)

//   await expect(
//     asserter.assert({
//       zipPath: { type: "string", value: "./somefile.zip" },
//       toDirPath: { type: "string", value: "./notthere" },
//     })
//   ).resolves.toBe(false)
//   await expect(asserter.rectify()).resolves.toBeUndefined()
// })

// test("With a file missing", async () => {
//   const asserter = new DirectoryZipped(container)

//   await expect(
//     asserter.assert({
//       zipPath: { type: "string", value: "./filemissing.zip" },
//       toDirPath: { type: "string", value: "./outdir" },
//     })
//   ).resolves.toBe(false)
//   await expect(asserter.rectify()).resolves.toBeUndefined()
// })

// test("With a file as different size", async () => {
//   const asserter = new DirectoryZipped(container)

//   await expect(
//     asserter.assert({
//       zipPath: { type: "string", value: "./filesize.zip" },
//       toDirPath: { type: "string", value: "./outdir" },
//     })
//   ).resolves.toBe(false)
//   await expect(asserter.rectify()).resolves.toBeUndefined()
// })

// test("With a file as a directory", async () => {
//   const asserter = new DirectoryZipped(container)

//   await expect(
//     asserter.assert({
//       zipPath: { type: "string", value: "./filedir.zip" },
//       toDirPath: { type: "string", value: "./outdir" },
//     })
//   ).resolves.toBe(false)
//   await expect(asserter.rectify()).resolves.toBeUndefined()
// })
