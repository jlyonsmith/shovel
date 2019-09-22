import { GroupAbsent } from "./GroupAbsent"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { Script } from "vm"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      runningAsRoot: () => true,
      getGroups: async (fs) => [{ name: "news", gid: 10, users: [] }],
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return 0
      }),
    },
  }

  const asserter = new GroupAbsent(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { name: 1 }))
  ).rejects.toThrow(ScriptError)

  // With group absent
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(true)

  // With group present
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "news" }))
  ).resolves.toBe(false)

  // With group absent and not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "news" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => undefined,
    },
  }
  const asserter = new GroupAbsent(container)

  asserter.expandedName = "blah"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new GroupAbsent({})

  asserter.expandedName = "news"

  expect(asserter.result()).toEqual({ name: asserter.expandedName })
})
