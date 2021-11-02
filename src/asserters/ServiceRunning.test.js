import { jest } from "@jest/globals"
import { ServiceRunning } from "./ServiceRunning.js"
import { createAssertNode } from "../testUtil.js"
import { ScriptError } from "../ScriptError.js"

let container = null

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
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
    asserter.assert(createAssertNode(asserter, { service: 1 }))
  ).rejects.toThrow(ScriptError)

  // With service active
  container.childProcess.exec = async () => ({ stdout: "active" })
  await expect(
    asserter.assert(createAssertNode(asserter, { service: "service" }))
  ).resolves.toBe(true)

  // With service inactive
  container.childProcess.exec = async () => {
    throw new Error()
  }
  await expect(
    asserter.assert(createAssertNode(asserter, { service: "otherService" }))
  ).resolves.toBe(false)

  // With service inactive not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { service: "otherService" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    Timeout: class Timeout {
      set() {
        return Promise.resolve()
      }
    },
    childProcess: {
      exec: async (command) => {
        if (command.includes("is-active")) {
          return { stdout: "active" }
        } else {
          return { stdout: "" }
        }
      },
    },
  }
  const asserter = new ServiceRunning(container)

  asserter.expandedServiceName = "service"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  // With service that doesn't start
  container.childProcess.exec = async (command) => {
    if (command.includes("is-active")) {
      throw new Error()
    } else {
      return {}
    }
  }

  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new ServiceRunning({})

  asserter.expandedServiceName = "otherService"

  expect(asserter.result()).toEqual({ service: asserter.expandedServiceName })
})
