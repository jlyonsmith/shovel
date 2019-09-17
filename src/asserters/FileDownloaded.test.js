import { FileDownloaded } from "./FileDownloaded"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
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
      access: jest.fn(async (path) => undefined),
    },
  }
  const testUrl = "http://localhost/somefile.txt"
  const testString = "The quick brown fox jumps over the lazy dog\n"
  const asserter = new FileDownloaded(container)

  // Missing/bad url
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { url: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing/bad digest
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "", digest: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing/bad toPath
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "", digest: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { url: "", digest: "", toPath: 1 })
    )
  ).rejects.toThrow(ScriptError)

  // With correct file already in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
        toPath: "./abc/somefile.txt",
      })
    )
  ).resolves.toBe(true)

  // With no file in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
        toPath: "./def/somefile.txt",
      })
    )
  ).resolves.toBe(false)

  // With incorrect file already in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
        toPath: "./abc/badfile.txt",
      })
    )
  ).resolves.toBe(false)

  // With bad toPath directory
  container.fs.access = jest.fn(async () => {
    throw new Error()
  })
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest:
          "c03905fcdab297513a620ec81ed46ca44ddb62d41cbbd83eb4a5a3592be26a69",
        toPath: "./abc/badfile.txt",
      })
    )
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      createWriteStream: jest.fn(() => ({})),
      remove: jest.fn(async (path) => null),
    },
    fetch: jest.fn(async (url) => ({})),
    util: {
      pipeToPromise: jest.fn(async () => undefined),
    },
  }
  const asserter = new FileDownloaded(container)

  asserter.toFileExists = false
  asserter.expandedToPath = "/foo/bar.txt"
  asserter.expandedUrl = "http://something.com"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.toFileExists = true

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileDownloaded({})

  asserter.expandedToPath = "/somedir/somefile.txt"

  expect(asserter.result()).toEqual({ toPath: asserter.expandedToPath })
})
