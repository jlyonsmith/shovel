import { ServiceRunning } from "./ServiceRunning"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {},
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }

  const asserter = new ServiceRunning(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { name: 1 }))
  ).rejects.toThrow(ScriptError)

  // With service active
  container.childProcess.exec = async () => ({ stdout: "active" })
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "service" }))
  ).resolves.toBe(true)

  // With service inactive
  container.childProcess.exec = async () => ({ stdout: "" })
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "otherService" }))
  ).resolves.toBe(false)

  // With service inactive not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "otherService" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => ({
        stdout: "active",
      }),
    },
  }
  const asserter = new ServiceRunning(container)

  asserter.expandedName = "service"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  // With service that doesn't start
  container.childProcess.exec = async (command) => {
    if (command.includes("is-active")) {
      return { stdout: "failed" }
    } else {
      return { stdout: "" }
    }
  }
  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new ServiceRunning({})

  asserter.expandedName = "otherService"

  expect(asserter.result()).toEqual({ name: asserter.expandedName })
})
