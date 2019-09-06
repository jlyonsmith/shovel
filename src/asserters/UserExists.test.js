import { UserExists } from "./UserExists"
import { createAssertNode } from "./testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    util: {
      getUsers: jest.fn(async () => [{ name: "games" }]),
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

test("With user existing", async () => {
  const asserter = new UserExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "games" }))
  ).resolves.toBe(true)
})

test("With user absent", async () => {
  const asserter = new UserExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
