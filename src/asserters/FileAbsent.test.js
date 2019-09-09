import { FileAbsent } from "./FileAbsent"
import { createAssertNode } from "../testUtil"

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

test("FileAbsent with no dir or file existing", async () => {
  const asserter = new FileAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/notthere" }))
  ).resolves.toBe(true)
})

test("FileAbsent with file existing", async () => {
  const asserter = new FileAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somefile" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("FileAbsent with dir instead of file existing", async () => {
  const asserter = new FileAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somedir" }))
  ).rejects.toThrow(Error)
})
