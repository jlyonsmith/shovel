import { GroupExists } from "./GroupExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      runningAsRoot: jest.fn(() => true),
    },
    _groups: [
      { name: "mail", password: "", gid: 10, users: ["mail"] },
      { name: "nfs", password: "", gid: 1, users: ["nfs"] },
    ],
  }
  const asserter = new GroupExists(container)

  // Bad group
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { group: 1, gid: 10 }))
  ).rejects.toThrow(ScriptError)

  // Bad gid
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "mail", gid: "10" }))
  ).rejects.toThrow(ScriptError)

  // With group absent
  container.util.getGroups = jest.fn(async (fs) => [])
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "notthere" }))
  ).resolves.toBe(false)

  // With group existing
  container.util.getGroups = jest.fn(async (fs) => [{ name: "mail", gid: 10 }])
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "mail" }))
  ).resolves.toBe(true)

  // With group existing with same name and gid
  container.util.getGroups = jest.fn(async (fs) => [{ name: "mail", gid: 10 }])
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "mail", gid: 10 }))
  ).resolves.toBe(true)

  // With group exists with different gid
  container.util.getGroups = jest.fn(async (fs) => [{ name: "nfs", gid: 10 }])
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "nfs", gid: 11 }))
  ).resolves.toBe(false)

  // With group present with different gid and not root
  container.util.runningAsRoot = jest.fn(() => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "nfs", gid: 11 }))
  ).rejects.toThrow(ScriptError)

  // With group absent and not root
  container.util.getGroups = jest.fn(async (fs) => [])
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "notthere" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: jest.fn(async () => undefined),
    },
    util: {
      getGroups: jest.fn(async () => [{ name: "name", gid: 12 }]),
    },
  }
  const asserter = new GroupExists(container)

  asserter.expandedGroupName = "name"
  asserter.modify = false
  asserter.gid = undefined

  // Add
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Modify
  asserter.modify = true
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Group not present after command
  container.util.getGroups = jest.fn(async () => [])
  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new GroupExists({})

  asserter.expandedGroupName = "name"
  asserter.gid = 12

  expect(asserter.result()).toEqual({
    group: asserter.expandedGroupName,
    gid: 12,
  })
})
