import { PackageInstalled } from "./PackageInstalled"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("object")
      return new Error(message)
    },
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return 0
      }),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
  }
})

test("With package installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "package" } })
  ).resolves.toBe(true)
})

test("With package not installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "notthere" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
