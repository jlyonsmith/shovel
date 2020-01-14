import { FilesDeleted } from "./FilesDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { PathInfo } from "../util"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    util: {
      pathInfo: async (path) => {
        if (path === "/somedir") {
          return new PathInfo({
            isDirectory: () => true,
            isFile: () => false,
          })
        } else if (path === "/somefile") {
          return new PathInfo({
            isDirectory: () => false,
            isFile: () => true,
          })
        } else if (path === "/") {
          return new PathInfo({
            isDirectory: () => true,
            isFile: () => false,
            mode: 0o777,
          })
        } else {
          return new PathInfo()
        }
      },
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
      unlink: jest.fn(async () => null),
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

  asserter.interpolator = ["blah"]

  expect(asserter.result(false)).toEqual({ files: asserter.expandedFiles })
})
