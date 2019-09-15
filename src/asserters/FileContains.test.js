import { FileContains } from "./FileContains"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    fs: {
      access: jest.fn(async () => undefined),
      createReadStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")
        return new stream.Readable({
          read(size) {
            this.push(testString)
            this.push(null)
          },
        })
      }),
    },
    util: {
      generateDigestFromFile: jest.fn(async () => "1234567890"),
      generateDigest: jest.fn(() => "1234567890"),
    },
  }

  const asserter = new FileContains(container)

  // Missing path
  await expect(
    asserter.assert(createAssertNode(asserter, { contents: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad path
  await expect(
    asserter.assert(createAssertNode(asserter, { path: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing contents
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad contents
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "", contents: 1 }))
  ).rejects.toThrow(ScriptError)

  // Everything the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        contents: "abc",
      })
    )
  ).resolves.toBe(true)

  // Contents different
  container.util.generateDigest = jest.fn(async () => "0987654321")
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        contents: "xyz",
      })
    )
  ).resolves.toBe(false)

  // File missing or inaccessible
  container.fs.access = jest.fn(async () => {
    throw new Error()
  })
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        contents: "xyz",
      })
    )
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      outputFile: jest.fn(async (fileName, data) => {
        expect(typeof fileName).toBe("string")
        expect(typeof data).toBe("string")
      }),
    },
  }
  const asserter = new FileContains(container)

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "some contents"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileContains({})

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "some contents"

  expect(asserter.result()).toEqual({
    path: asserter.expandedPath,
    contents: asserter.expandedContents,
  })
})
