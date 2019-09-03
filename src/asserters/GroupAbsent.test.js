import { GroupAbsent } from "./GroupAbsent"
import { createAssertNode } from "./testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    util: {
      getGroups: jest.fn(async (fs) => [{ name: "news", gid: 10, users: [] }]),
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

test("With group absent", async () => {
  const asserter = new GroupAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(true)
})

test("With group present", async () => {
  const asserter = new GroupAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "news" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
