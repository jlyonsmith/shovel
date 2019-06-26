import { FileExists } from "./FileExists"

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
      ensureFile: jest.fn(async (fileName) => {
        expect(typeof fileName).toBe("string")
      }),
    },
  }
})

test("FileExists with file existing", async () => {
  const asserter = new FileExists(container)

  await expect(asserter.assert({ path: "/somefile" })).resolves.toBe(true)
})

test("FileExists with no file or dir existing", async () => {
  const asserter = new FileExists(container)

  await expect(asserter.assert({ path: "/notthere" })).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("FileExists with dir instead of file existing", async () => {
  const asserter = new FileExists(container)

  await expect(asserter.assert({ path: "/somedir" })).resolves.toBe(false)
  await expect(asserter.actualize()).rejects.toThrow(Error)
})
