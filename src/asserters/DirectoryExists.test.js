import { jest } from "@jest/globals"
import { DirectoryExists } from "./DirectoryExists.js"
import { createAssertNode } from "../testUtil.js"
import { ScriptError } from "../ScriptError.js"
import util, { PathInfo } from "../util.js"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
        gid: 0,
      })),
    },
    util: {
      pathInfo: async (path) => {
        if (path === "/somedir") {
          return new PathInfo({
            isDirectory: () => true,
            isFile: () => false,
            mode: 0o754,
            uid: 10,
            gid: 10,
          })
        } else if (path === "/filethere") {
          return new PathInfo({
            isDirectory: jest.fn(() => false),
            isFile: jest.fn(() => true),
          })
        } else if (path === "/") {
          return new PathInfo({
            isDirectory: () => true,
            isFile: () => false,
            mode: 0o777,
            uid: 10,
            gid: 10,
          })
        } else {
          return new PathInfo()
        }
      },
      getUsers: jest.fn(async () => [
        { uid: 0, gid: 0, name: "root" },
        { uid: 10, gid: 10, name: "user1" },
        { uid: 20, gid: 10, name: "user2" },
      ]),
      getGroups: jest.fn(async () => [
        { gid: 0, name: "root" },
        { gid: 10, name: "group1" },
        { gid: 20, name: "group2" },
      ]),
      parseOwnerNode: util.parseOwnerNode,
      parseModeNode: util.parseModeNode,
    },
  }

  const asserter = new DirectoryExists(container)

  // Bad arguments
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: 1 }))
  ).rejects.toThrow(ScriptError)

  // Directory there with good owner and mode
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: "user1", group: "group1" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).resolves.toBe(true)
  expect(asserter.result()).toEqual({ directory: "/somedir" })

  // Directory there with different owners when root
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: 0, group: "root" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).resolves.toBe(false)

  // Directory there with different mode when root
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: "user1", group: "group1" },
        mode: { user: "rw-", group: "r--", other: "---" },
      })
    )
  ).resolves.toBe(false)

  // Directory there with different owner when not root or owner
  container.os.userInfo = jest.fn(() => ({
    uid: 20,
    gid: 20,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: "root", group: "root" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).rejects.toThrow(ScriptError)

  // Directory there with different mode when not root but owner
  container.os.userInfo = jest.fn(() => ({
    uid: 10,
    gid: 10,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: "user1", group: "group1" },
        mode: { user: "rw-", group: "r--", other: "---" },
      })
    )
  ).resolves.toBe(false)

  // Directory there with different mode when not root or owner
  container.os.userInfo = jest.fn(() => ({
    uid: 20,
    gid: 20,
  }))
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        directory: "/somedir",
        owner: { user: "user1", group: "group1" },
        mode: { user: "rw-", group: "r--", other: "---" },
      })
    )
  ).rejects.toThrow(ScriptError)

  // Directory not there and no file with same name
  container.os.userInfo = jest.fn(() => ({
    uid: 0,
    gid: 0,
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/notthere" }))
  ).resolves.toBe(false)

  // File with same name present
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/filethere" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      ensureDir: jest.fn(async (directory, options) => null),
      chown: jest.fn(async (directory, uid, gid) => null),
      chmod: jest.fn(async (directory, mode) => null),
    },
  }

  const asserter = new DirectoryExists(container)

  asserter.expandedDirectory = "/somefile"
  asserter.mode = 0o777
  asserter.owner = { uid: 10, gid: 20 }

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new DirectoryExists({})

  asserter.expandedDirectory = "/somefile"
  asserter.mode = 0o777
  asserter.owner = { uid: 10, gid: 20 }

  expect(asserter.result(true)).toEqual({ directory: "/somefile" })
  expect(asserter.result(false)).toEqual({ directory: "/somefile" })
})
