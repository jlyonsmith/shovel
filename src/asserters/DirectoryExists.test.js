import { DirectoryExists } from "./DirectoryExists"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("string")
      return new Error(message)
    },
    expandString: (s) => s,
    withNode: { line: 0, column: 0 },
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
      ensureDir: jest.fn(async (dirName) => null),
    },
  }
})

test("DirectoryExists with dir existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert({ path: { type: "string", value: "/somedir" } })
  ).resolves.toBe(true)
})

test("DirectoryExists with no dir or file existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert({ path: { type: "string", value: "/notthere" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("DirectoryExists with file instead of dir existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert({ path: { type: "string", value: "/somefile" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).rejects.toThrow(Error)
})
