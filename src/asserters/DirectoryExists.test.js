import { DirectoryExists } from "./DirectoryExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import util from "../util"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {},
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
        gid: 0,
      })),
    },
    util: {
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
      canAccess: jest.fn(async () => true),
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

  // Use this file for several tests
  container.fs.lstat = jest.fn(async () => ({
    isDirectory: jest.fn(() => true),
    isFile: jest.fn(() => false),
    mode: 0o754,
    uid: 10,
    gid: 10,
  }))

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
  container.fs.lstat = jest.fn(async () => {
    throw new Error("ENOENT")
  })
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/notthere" }))
  ).resolves.toBe(false)

  // Directory not there and no file with same name
  container.util.canAccess = jest.fn(async () => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/notthere" }))
  ).rejects.toThrow(ScriptError)

  // File with same name present
  container.fs.lstat = jest.fn(async () => ({
    isDirectory: jest.fn(() => false),
    isFile: jest.fn(() => true),
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/somefile" }))
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
