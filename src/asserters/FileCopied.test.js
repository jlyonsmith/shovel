import { FileCopied } from "./FileCopied"
import stream from "stream"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("string")
      return new Error(message)
    },
    expandString: (s) => s,
    fs: {
      createReadStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")

        return new stream.Readable({
          read(size) {
            if (fileName === "/badfile") {
              this.push("not the test string")
            } else {
              this.push("The quick brown fox jumps over the lazy dog\n")
            }
            this.push(null)
          },
        })
      }),
      copy: jest.fn(async (fromFileName, toFileName) => {
        expect(typeof fromFileName).toBe("string")
        expect(typeof toFileName).toBe("string")
      }),
      lstat: jest.fn(async (path) => {
        if (path === "/somefile" || path === "/otherfile") {
          return {
            isDirectory: jest.fn(() => false),
            isFile: jest.fn(() => true),
          }
        } else {
          throw new Error("ENOENT")
        }
      }),
      ensureDir: jest.fn(async (dirPath) => {
        expect(typeof dirPath).toBe("string")
      }),
    },
  }
})

test("FileCopied with files the same", async () => {
  const asserter = new FileCopied(container)

  await expect(
    asserter.assert({
      fromPath: { type: "string", value: "/somefile" },
      toPath: { type: "string", value: "/otherfile" },
    })
  ).resolves.toBe(true)
  expect(container.fs.createReadStream).toHaveBeenCalledTimes(2)
})

test("FileCopied with from file non-existent", async () => {
  const asserter = new FileCopied(container)

  await expect(
    asserter.assert({
      fromPath: { type: "string", value: "/notthere" },
      toPath: { type: "string", value: "/otherfile" },
    })
  ).resolves.toBe(false)
})

test("FileCopied with to file non-existent", async () => {
  const asserter = new FileCopied(container)

  await expect(
    asserter.assert({
      fromPath: { type: "string", value: "/somefile" },
      toPath: { type: "string", value: "/notthere" },
    })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("FileCopied with different files", async () => {
  const asserter = new FileCopied(container)

  await expect(
    asserter.assert({
      fromPath: { type: "string", value: "/somefile" },
      toPath: { type: "string", value: "/badfile" },
    })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
