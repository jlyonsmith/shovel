import { ServiceInactive } from "./ServiceInactive"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {},
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }

  const asserter = new ServiceInactive(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { name: 1 }))
  ).rejects.toThrow(ScriptError)

  // With service inactive
  container.childProcess.exec = async () => ({ stdout: "inactive" })
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "service" }))
  ).resolves.toBe(true)

  // With service active
  container.childProcess.exec = async () => ({ stdout: "active" })
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "otherService" }))
  ).resolves.toBe(false)

  // With service active and not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "otherService" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => ({
        stdout: "failed",
      }),
    },
  }
  const asserter = new ServiceInactive(container)

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new ServiceInactive({})

  asserter.expandedName = "blah"

  expect(asserter.result()).toEqual({ name: asserter.expandedName })
})
