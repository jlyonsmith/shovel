import { DirectoryExists } from "./DirectoryExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    fs: {
      lstat: jest.fn(async (dirName) => {
        if (dirName === "/somedir") {
          return {
            isDirectory: jest.fn(() => true),
            isFile: jest.fn(() => false),
            mode: 0o754,
            uid: 0,
            gid: 0,
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
      ensureDir: jest.fn(async (path, options) => null),
      chown: jest.fn(async (path, uid, gid) => null),
      chmod: jest.fn(async (path, mode) => null),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
        gid: 0,
        name: "root",
      })),
    },
    util: {
      getUsers: jest.fn(async () => null),
      getGroups: jest.fn(async () => null),
      parseOwnerNode: jest.fn((userInfo, users, groups, ownerNode) => ({
        uid: 0,
        gid: 0,
      })),
      parseModeNode: jest.fn(() => 0o754),
    },
  }
})

test("DirectoryExists with good owner and perms", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somedir",
        owner: { user: "root", group: "root" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).resolves.toBe(true)
  expect(asserter.result()).toEqual({ path: "/somedir" })
})

test("DirectoryExists with no dir or file existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({ path: "/notthere" })
})

test("DirectoryExists with file instead of dir existing", async () => {
  const asserter = new DirectoryExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somefile" }))
  ).rejects.toThrow(ScriptError)
})
