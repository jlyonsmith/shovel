import { FileCopied } from "./FileCopied"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    interpolateNode: (node) => node.value,
    util: {
      fileExists: jest.fn(async (path) => {
        if (path === "/notthere") {
          return false
        } else {
          return true
        }
      }),
      generateDigestFromFile: async (path) => {
        if (path === "/badfile") {
          return "0987654321"
        } else {
          return "1234567890"
        }
      },
    },
  }

  const asserter = new FileCopied(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { fromFile: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { fromFile: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { fromFile: "", toFile: 1 }))
  ).rejects.toThrow(ScriptError)

  // With files the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        fromFile: "/somefile",
        toFile: "/otherfile",
      })
    )
  ).resolves.toBe(true)

  // With fromFile file non-existent
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        fromFile: "/notthere",
        toFile: "/otherfile",
      })
    )
  ).rejects.toThrow(ScriptError)

  // FileCopied with toFile file non-existent
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        fromFile: "/somefile",
        toFile: "/notthere",
      })
    )
  ).resolves.toBe(false)

  // FileCopied with different files
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        fromFile: "/somefile",
        toFile: "/badfile",
      })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const asserter = new FileCopied({
    fs: {
      copy: async () => undefined,
    },
  })

  asserter.expandedFromFile = "/blah"
  asserter.expandedToFile = "/blurp"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", async () => {
  const asserter = new FileCopied({})

  asserter.expandedFromFile = "/blah"
  asserter.expandedToFile = "/blurp"

  expect(asserter.result()).toEqual({
    fromFile: asserter.expandedFromFile,
    toFile: asserter.expandedToFile,
  })
})
