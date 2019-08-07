import { FileZipped } from "./FileZipped"
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
    yazl: {},
  }
})

test("With zip file not present", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./missing.zip" },
      toDirPath: { type: "string", value: "./outdir" },
    })
  ).rejects.toThrow()
})

test("With all files zipped and the same", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./somefile.zip" },
      toDirPath: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(true)
})

test("With output directory missing", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./somefile.zip" },
      toDirPath: { type: "string", value: "./notthere" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file missing", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./filemissing.zip" },
      toDirPath: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file as different size", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./filesize.zip" },
      toDirPath: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("With a file as a directory", async () => {
  const asserter = new FileZipped(container)

  await expect(
    asserter.assert({
      zipPath: { type: "string", value: "./filedir.zip" },
      toDirPath: { type: "string", value: "./outdir" },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
