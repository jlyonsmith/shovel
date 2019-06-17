import { DirectoryAbsent } from "./DirectoryAbsent"

let container = null

beforeAll(() => {
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
      remove: jest.fn(async (dirName) => null),
    },
  }
})

test("DirectoryAbsent with no dir or file existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(asserter.assert({ path: "/notthere" })).resolves.toBe(true)
})

test("DirectoryAbsent with dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(asserter.assert({ path: "/somedir" })).resolves.toBe(false)
  await expect(asserter.actualize({ path: "/somedir" })).resolves
})

test("DirectoryAbsent with file instead of dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(asserter.assert({ path: "/somefile" })).resolves.toBe(true)
  await expect(asserter.actualize({ path: "/somefile" })).rejects.toThrow(Error)
})
