import { DirectoryAbsent } from "./DirectoryAbsent"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    assertNode: { line: 0, column: 0 },
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
    asserter.assert({ path: { type: "string", value: "/notthere" } })
  ).resolves.toBe(true)
})

test("DirectoryAbsent with dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(
    asserter.assert({ path: { type: "string", value: "/somedir" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("DirectoryAbsent with file instead of dir existing", async () => {
  const asserter = new DirectoryAbsent(container)

  await expect(
    asserter.assert({ path: { type: "string", value: "/somefile" } })
  ).resolves.toBe(true)
  await expect(asserter.rectify()).rejects.toThrow(Error)
})
