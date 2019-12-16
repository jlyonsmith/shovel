import { FileDeleted } from "./FileDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {
      lstat: jest.fn(async (fileName) => {
        if (fileName === "/somedir") {
          return {
            isDirectory: jest.fn(() => true),
            isFile: jest.fn(() => false),
          }
        } else if (fileName === "/somefile") {
          return {
            isDirectory: jest.fn(() => false),
            isFile: jest.fn(() => true),
          }
        } else {
          throw new Error("ENOENT")
        }
      }),
    },
  }

  const asserter = new FileDeleted(container)

  // Missing args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )

  // Bad file
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // File absent
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/notthere" }))
  ).resolves.toBe(true)

  // File exists
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/somefile" }))
  ).resolves.toBe(false)

  // Directory existing instead of file
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/somedir" }))
  ).rejects.toThrow(Error)
})

test("rectify", async () => {
  const container = { fs: { unlink: jest.fn(async () => null) } }
  const asserter = new FileDeleted(container)

  asserter.expandedFile = "foo.txt"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileDeleted({})

  asserter.expandedFile = "foo.txt"

  expect(asserter.result()).toEqual({ file: asserter.expandedFile })
})
