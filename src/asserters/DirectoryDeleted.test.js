import { DirectoryDeleted } from "./DirectoryDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    fs: {
      lstat: jest.fn(async (dirName) => {
        if (dirName === "/somedir") {
          return {
            isDirectory: jest.fn(() => true),
            isFile: jest.fn(() => false),
          }
        } else if (dirName === "/somefile") {
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

  const asserter = new DirectoryDeleted(container)

  // Bad arguments
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { path: 1 }))
  ).rejects.toThrow(ScriptError)

  // DirectoryDeleted with no dir or file existing
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/notthere" }))
  ).resolves.toBe(true)

  // DirectoryDeleted with dir existing
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somedir" }))
  ).resolves.toBe(false)

  // DirectoryDeleted with file instead of dir existing
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somefile" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      remove: jest.fn(async (dirName) => null),
    },
  }
  const asserter = new DirectoryDeleted(container)

  asserter.expandedPath = "blah"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new DirectoryDeleted({})

  asserter.expandedPath = "blah"

  expect(asserter.result()).toEqual({ path: asserter.expandedPath })
})
