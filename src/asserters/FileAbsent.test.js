import { FileAbsent } from "./FileAbsent"

let container = null

beforeEach(() => {
  container = {
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

  await expect(asserter.assert({ path: "/notthere" })).resolves.toBe(true)
})

test("FileAbsent with file existing", async () => {
  const asserter = new FileAbsent(container)

  await expect(asserter.assert({ path: "/somefile" })).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("FileAbsent with dir instead of file existing", async () => {
  const asserter = new FileAbsent(container)

  await expect(asserter.assert({ path: "/somedir" })).resolves.toBe(true)
  await expect(asserter.actualize()).rejects.toThrow(Error)
})
