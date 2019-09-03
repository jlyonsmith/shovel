import { GroupExists } from "./GroupExists"
import { createAssertNode } from "./testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    util: {
      getGroups: jest.fn(async (fs) => [
        { name: "mail", password: "", gid: 10, users: ["mail"] },
      ]),
    },
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

test("With group existing", async () => {
  const asserter = new GroupExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "mail" }))
  ).resolves.toBe(true)
})

test("With group absent", async () => {
  const asserter = new GroupExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({ name: "notthere" })
})
