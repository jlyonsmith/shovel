import { FileExists } from "./FileExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError.js"
import { PathInfo } from "../util"

let container = null

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    os: {
      userInfo: () => ({
        uid: 0,
        gid: 0,
      }),
    },
    util: {
      pathInfo: async (path) => {
        switch (path) {
          case "/":
          case "/bar":
            return new PathInfo({
              isFile: () => true,
              isDirectory: () => true,
              mode: 0o777,
            })
          case "/file1":
            return new PathInfo({
              isDirectory: () => false,
              isFile: () => true,
              mode: 0o644,
              uid: 0,
              gid: 0,
            })
          case "/file2":
            return new PathInfo({
              isDirectory: () => false,
              isFile: () => true,
              mode: 0o644,
              uid: 0,
              gid: 10,
            })
          case "/file3":
            return new PathInfo({
              isDirectory: () => false,
              isFile: () => true,
              mode: 0o111,
              uid: 0,
              gid: 0,
            })
          case "/file4":
            return new PathInfo({
              isDirectory: jest.fn(() => false),
              isFile: jest.fn(() => true),
              mode: 0o111,
              uid: 0,
              gid: 0,
            })
          default:
            return new PathInfo()
        }
      },
      getUsers: async () => [
        { uid: 0, gid: 0, name: "root" },
        { uid: 10, gid: 10, name: "user1" },
        { uid: 20, gid: 10, name: "user2" },
      ],
      getGroups: async () => [
        { gid: 0, name: "root" },
        { gid: 10, name: "group1" },
        { gid: 20, name: "group2" },
      ],
      parseOwnerNode: (ownerNode, users, groups) => ({
        uid: 0,
        gid: 0,
      }),
      parseModeNode: () => 0o644,
    },
  }

  const asserter = new FileExists(container)

  // Missing args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )

  // Bad file
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // File exists
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/file1",
        owner: { uid: 0, gid: 0 },
        mode: { user: "rw-", group: "r--", other: "r--" },
      })
    )
  ).resolves.toBe(true)

  // File exists with different group owner
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/file2",
        owner: { uid: 0, gid: 0 },
        mode: { user: "rw-", group: "r--", other: "r--" },
      })
    )
  ).resolves.toBe(false)

  // File exists with different group owner and not root user
  container.os.userInfo = jest.fn(() => ({
    uid: 10,
    gid: 10,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/file2",
        owner: { uid: 0, gid: 0 },
        mode: { user: "rw-", group: "r--", other: "r--" },
      })
    )
  ).rejects.toThrow(ScriptError)

  // File exists with different mode
  container.os.userInfo = jest.fn(() => ({
    uid: 0,
    gid: 0,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/file3",
        owner: { uid: 0, gid: 0 },
        mode: { user: "rw-", group: "r--", other: "r--" },
      })
    )
  ).resolves.toBe(false)

  // File exists with different mode and not root
  container.os.userInfo = jest.fn(() => ({
    uid: 10,
    gid: 10,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/file4",
        owner: { uid: 0, gid: 0 },
        mode: { user: "rw-", group: "r--", other: "r--" },
      })
    )
  ).rejects.toThrow(ScriptError)
  container.os.userInfo = jest.fn(() => ({
    uid: 0,
    gid: 0,
  }))

  // File does not exist and root directory accessible
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/bar/notthere" }))
  ).resolves.toBe(false)

  // File does not exist and root directory not accessible
  container.util.canAccess = jest.fn(async () => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/foo/notthere" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      open: async () => undefined,
      close: async () => undefined,
      chown: async (path, uid, gid) => null,
      chmod: async (path, mode) => null,
    },
  }
  const asserter = new FileExists(container)

  asserter.expandedFile = "/notthere"
  asserter.mode = 0o777
  asserter.owner = { uid: 0, gid: 0 }

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileExists({})

  asserter.expandedFile = "/notthere"

  expect(asserter.result()).toEqual({ file: asserter.expandedFile })
})
