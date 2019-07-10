import { FileDownloaded } from "./FileDownloaded"
import stream from "stream"

let container = null
const testUrl = "http://localhost/somefile.txt"
const testString = "The quick brown fox jumps over the lazy dog\n"

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("string")
      return new Error(message)
    },
    expandString: (s) => s,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
    fs: {
      createReadStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")

        return new stream.Readable({
          read(size) {
            if (fileName === "./abc/badfile.txt") {
              this.push("not the test string")
            } else {
              this.push(testString)
            }
            this.push(null)
          },
        })
      }),
      createWriteStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")

        return new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        })
      }),
      lstat: jest.fn(async (path) => {
        if (path === "./abc/somefile.txt" || path === "./abc/badfile.txt") {
          return {
            isDirectory: jest.fn(() => false),
            isFile: jest.fn(() => true),
          }
        } else {
          throw new Error("ENOENT")
        }
      }),
      ensureDir: jest.fn(async (dirName) => null),
      remove: jest.fn(async (path) => null),
    },
    fetch: jest.fn(async (url) => {
      expect(typeof url).toBe("string")

      return {
        body: new stream.Readable({
          read(size) {
            this.push(testString)
            this.push(null)
          },
        }),
      }
    }),
  }
})

test("With correct file already in place", async () => {
  const asserter = new FileDownloaded(container)

  await expect(
    asserter.assert({
      url: { type: "string", value: testUrl },
      digest: {
        type: "string",
        value:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
      },
      toPath: { type: "string", value: "./abc/somefile.txt" },
    })
  ).resolves.toBe(true)
})

test("With no file in place", async () => {
  const asserter = new FileDownloaded(container)

  await expect(
    asserter.assert({
      url: { type: "string", value: testUrl },
      digest: {
        type: "string",
        value:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
      },
      toPath: { type: "string", value: "./def/somefile.txt" },
    })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("With incorrect file already in place", async () => {
  const asserter = new FileDownloaded(container)

  await expect(
    asserter.assert({
      url: { type: "string", value: testUrl },
      digest: {
        type: "string",
        value:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
      },
      toPath: { type: "string", value: "./abc/badfile.txt" },
    })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
