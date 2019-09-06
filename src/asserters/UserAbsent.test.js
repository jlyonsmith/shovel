import { UserAbsent } from "./UserAbsent"
import { createAssertNode } from "./testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return 0
      }),
    },
    util: {
      getUsers: jest.fn(async () => [{ name: "games" }]),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
  }
})

test("With user absent", async () => {
  const asserter = new UserAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(true)
})

test("With user present", async () => {
  const asserter = new UserAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "games" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
