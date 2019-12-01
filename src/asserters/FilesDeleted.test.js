import { FilesDeleted } from "./FilesDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
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

  const asserter = new FilesDeleted(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { files: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { files: [1] }))
  ).rejects.toThrow(ScriptError)

  // FilesDeleted with no dir or files existing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        files: ["/notthere", "/alsonotthere"],
      })
    )
  ).resolves.toBe(true)

  // FilesDeleted with file existing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        files: ["/somefile", "/notthere"],
      })
    )
  ).resolves.toBe(false)

  // FilesDeleted with dir instead of file existing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        files: ["/nothere", "/somedir"],
      })
    )
  ).rejects.toThrow(Error)
})

test("rectify", async () => {
  const container = {
    fs: {
      unlink: jest.fn(async (fileName) => null),
    },
  }
  const asserter = new FilesDeleted(container)

  asserter.unlinkedFiles = ["blah"]

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FilesDeleted({})

  asserter.unlinkedFiles = ["blah"]

  expect(asserter.result(true)).toEqual({ files: asserter.unlinkedFiles })

  asserter.expandStringNode = ["blah"]

  expect(asserter.result(false)).toEqual({ files: asserter.expandedFiles })
})
