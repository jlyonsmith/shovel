import { GroupExists } from "./GroupExists"
import { createAssertNode } from "./testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    util: {
      getGroups: jest.fn(async (fs) => container._groups),
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        if (path.startsWith("groupadd")) {
          const parts = path.split(" ")
          const group = { name: parts[2], gid: 12 }

          container._groups.push(group)
        }
        return 0
      }),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
    _groups: [
      { name: "mail", password: "", gid: 10, users: ["mail"] },
      { name: "nfs", password: "", gid: 1, users: ["nfs"] },
    ],
  }
})

test("With group existing with same name and gid", async () => {
  const asserter = new GroupExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "mail", gid: 10 }))
  ).resolves.toBe(true)
})

test("With group exists with different gid", async () => {
  const asserter = new GroupExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "nfs", gid: 11 }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({ name: "nfs", gid: 11 })
})

test("With group absent", async () => {
  const asserter = new GroupExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({ name: "notthere", gid: 12 })
})
