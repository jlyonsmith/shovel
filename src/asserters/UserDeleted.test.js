import { UserDeleted } from "./UserDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { Script } from "vm"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      runningAsRoot: () => true,
      getUsers: async () => [{ name: "games" }],
    },
  }

  const asserter = new UserDeleted(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { name: 1 }))
  ).rejects.toThrow(ScriptError)

  // With user absent
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(true)

  // With user present
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "games" }))
  ).resolves.toBe(false)

  // With user present and not running as root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "games" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => undefined,
    },
  }
  const asserter = new UserDeleted(container)

  asserter.expandedName = "blah"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new UserDeleted({})

  asserter.expandedName = "name"

  expect(asserter.result()).toEqual({ name: asserter.expandedName })
})
