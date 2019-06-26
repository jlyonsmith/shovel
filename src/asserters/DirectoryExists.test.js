import { DirectoryExists } from "./DirectoryExists"

let container = null

beforeEach(() => {
  container = {
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
      ensureDir: jest.fn(async (dirName) => null),
    },
  }
})

test("DirectoryExists with dir existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(asserter.assert({ path: "/somedir" })).resolves.toBe(true)
})

test("DirectoryExists with no dir or file existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(asserter.assert({ path: "/notthere" })).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("DirectoryExists with file instead of dir existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(asserter.assert({ path: "/somefile" })).resolves.toBe(false)
  await expect(asserter.actualize()).rejects.toThrow(Error)
})