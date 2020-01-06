import { ServiceStopped } from "./ServiceStopped"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    childProcess: {},
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }

  const asserter = new ServiceStopped(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { service: 1 }))
  ).rejects.toThrow(ScriptError)

  // With service inactive
  container.childProcess.exec = async () => ({ stdout: "inactive" })
  await expect(
    asserter.assert(createAssertNode(asserter, { service: "service" }))
  ).resolves.toBe(true)

  // With service active
  container.childProcess.exec = async () => ({ stdout: "active" })
  await expect(
    asserter.assert(createAssertNode(asserter, { service: "otherService" }))
  ).resolves.toBe(false)

  // With service active and not root
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
          throw new Error()
        } else {
          return {}
        }
      },
    },
  }
  const asserter = new ServiceStopped(container)

  await asserter.rectify()
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // With service that doesn't stop
  container.childProcess.exec = async (command) => {
    if (command.includes("is-active")) {
      return { stdout: "active\n" }
    } else {
      return {}
    }
  }

  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new ServiceStopped({})

  asserter.expandedServiceName = "blah"

  expect(asserter.result()).toEqual({ service: asserter.expandedServiceName })
})
