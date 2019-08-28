import { FilesAbsent } from "./FilesAbsent"
import { createAssertNode } from "./testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
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
      unlink: jest.fn(async (fileName) => null),
    },
  }
})

test("FilesAbsent with no dir or files existing", async () => {
  const asserter = new FilesAbsent(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        paths: ["/notthere", "/alsonotthere"],
      })
    )
  ).resolves.toBe(true)
})

test("FilesAbsent with file existing", async () => {
  const asserter = new FilesAbsent(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        paths: ["/somefile", "/notthere"],
      })
    )
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("FilesAbsent with dir instead of file existing", async () => {
  const asserter = new FilesAbsent(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        paths: ["/nothere", "/somedir"],
      })
    )
  ).rejects.toThrow(Error)
})
