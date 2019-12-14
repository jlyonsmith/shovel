import { UserDeleted } from "./UserDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    interpolateNode: (node) => node.value,
    util: {
      runningAsRoot: () => true,
      getUsers: async () => [{ user: "games" }],
    },
  }

  const asserter = new UserDeleted(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { user: 1 }))
  ).rejects.toThrow(ScriptError)

  // With user absent
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "notthere" }))
  ).resolves.toBe(true)

  // With user present
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "games" }))
  ).resolves.toBe(false)

  // With user present and not running as root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "games" }))
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

  asserter.expandedName = "user"

  expect(asserter.result()).toEqual({ user: asserter.expandedName })
})
