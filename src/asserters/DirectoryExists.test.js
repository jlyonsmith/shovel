import { DirectoryExists } from "./DirectoryExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import * as util from "../util"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
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
    },
  }

  const asserter = new DirectoryExists(container)

  // Bad arguments
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { path: 1 }))
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
        path: "/somedir",
        owner: { user: "user1", group: "group1" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).resolves.toBe(true)
  expect(asserter.result()).toEqual({ path: "/somedir" })

  // Directory there with different owners when root
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somedir",
        owner: { user: 0, group: "root" },
        mode: { user: "rwx", group: "r-x", other: "r--" },
      })
    )
  ).resolves.toBe(false)

  // Directory there with different mode when root
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somedir",
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
        path: "/somedir",
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
        path: "/somedir",
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
        path: "/somedir",
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
    asserter.assert(createAssertNode(asserter, { path: "/notthere" }))
  ).resolves.toBe(false)

  // File with same name present
  container.fs.lstat = jest.fn(async () => ({
    isDirectory: jest.fn(() => false),
    isFile: jest.fn(() => true),
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "/somefile" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      ensureDir: jest.fn(async (path, options) => null),
      chown: jest.fn(async (path, uid, gid) => null),
      chmod: jest.fn(async (path, mode) => null),
    },
  }

  const asserter = new DirectoryExists(container)

  asserter.expandedPath = "/somefile"
  asserter.mode = 0o777
  asserter.owner = { uid: 10, gid: 20 }

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new DirectoryExists({})

  asserter.expandedPath = "/somefile"
  asserter.mode = 0o777
  asserter.owner = { uid: 10, gid: 20 }

  expect(asserter.result(true)).toEqual({ path: "/somefile" })
  expect(asserter.result(false)).toEqual({ path: "/somefile" })
})
