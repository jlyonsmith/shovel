import { FilesAbsent } from "./FilesAbsent"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("string")
      return new Error(message)
    },
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
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
    asserter.assert({
      paths: {
        type: "array",
        value: [
          { type: "string", value: "/notthere" },
          { type: "string", value: "/alsonotthere" },
        ],
      },
    })
  ).resolves.toBe(true)
})

test("FilesAbsent with file existing", async () => {
  const asserter = new FilesAbsent(container)

  await expect(
    asserter.assert({
      paths: {
        type: "array",
        value: [
          { type: "string", value: "/somefile" },
          { type: "string", value: "/notthere" },
        ],
      },
    })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("FilesAbsent with dir instead of file existing", async () => {
  const asserter = new FilesAbsent(container)

  await expect(
    asserter.assert({
      paths: {
        type: "array",
        value: [
          { type: "string", value: "/nothere" },
          { type: "string", value: "/somedir" },
        ],
      },
    })
  ).rejects.toThrow(Error)
})
