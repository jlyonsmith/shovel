import { HttpUrlDownloaded } from "./HttpUrlDownloaded"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      generateDigestFromFile: async (path) => {
        if (path === "badfile") {
          return "0987654321"
        } else {
          return "1234567890"
        }
      },
      fileExists: async (path) => {
        if (path === "missingfile") {
          return false
        } else {
          return true
        }
      },
    },
  }
  const testUrl = "http://localhost/somefile.txt"
  const testString = "The quick brown fox jumps over the lazy dog\n"
  const asserter = new HttpUrlDownloaded(container)

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
        digest: "1234567890",
        toPath: "somefile",
      })
    )
  ).resolves.toBe(true)

  // With no file in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest: "1234567890",
        toPath: "missingfile",
      })
    )
  ).resolves.toBe(false)

  // With incorrect file already in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest: "1234567890",
        toPath: "badfile",
      })
    )
  ).resolves.toBe(false)
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
  const asserter = new HttpUrlDownloaded(container)

  asserter.toFileExists = false
  asserter.expandedToPath = "/foo/bar.txt"
  asserter.expandedUrl = "http://something.com"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.toFileExists = true

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new HttpUrlDownloaded({})

  asserter.expandedToPath = "/somedir/somefile.txt"

  expect(asserter.result()).toEqual({ toPath: asserter.expandedToPath })
})
