import { FileCopied } from "./FileCopied"
import stream from "stream"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
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
    asserter.assert(createAssertNode(asserter, { from: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { from: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { from: "", to: 1 }))
  ).rejects.toThrow(ScriptError)

  // With files the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        from: "/somefile",
        to: "/otherfile",
      })
    )
  ).resolves.toBe(true)

  // With from file non-existent
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        from: "/notthere",
        to: "/otherfile",
      })
    )
  ).rejects.toThrow(ScriptError)

  // FileCopied with to file non-existent
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        from: "/somefile",
        to: "/notthere",
      })
    )
  ).resolves.toBe(false)

  // FileCopied with different files
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        from: "/somefile",
        to: "/badfile",
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

  asserter.expandedFromPath = "/blah"
  asserter.expandedToPath = "/blurp"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", async () => {
  const asserter = new FileCopied({})

  asserter.expandedFromPath = "/blah"
  asserter.expandedToPath = "/blurp"

  expect(asserter.result()).toEqual({
    fromPath: asserter.expandedFromPath,
    toPath: asserter.expandedToPath,
  })
})
