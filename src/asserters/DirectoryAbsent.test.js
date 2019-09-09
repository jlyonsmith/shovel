import { DirectoryAbsent } from "./DirectoryAbsent"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
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
      remove: jest.fn(async (dirName) => null),
    },
  }
})

test("DirectoryAbsent with no dir or file existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/notthere" }))
  ).resolves.toBe(true)
})

test("DirectoryAbsent with dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somedir" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  await expect(asserter.result()).toEqual({ path: "/somedir" })
})

test("DirectoryAbsent with file instead of dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somefile" }))
  ).rejects.toThrow(ScriptError)
})
