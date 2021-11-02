import { GroupDeleted } from "./GroupDeleted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError.js"
import { Script } from "vm"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
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

  const asserter = new GroupDeleted(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { group: 1 }))
  ).rejects.toThrow(ScriptError)

  // With group absent
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "notthere" }))
  ).resolves.toBe(true)

  // With group present
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "news" }))
  ).resolves.toBe(false)

  // With group absent and not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { group: "news" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => undefined,
    },
  }
  const asserter = new GroupDeleted(container)

  asserter.expandedGroupName = "blah"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new GroupDeleted({})

  asserter.expandedGroupName = "news"

  expect(asserter.result()).toEqual({ group: asserter.expandedGroupName })
})
