import { ServiceActive } from "./ServiceActive"
import { createAssertNode } from "../testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    childProcess: {
      _state: {
        service: "active",
        otherService: "inactive",
      },
      exec: jest.fn(async (command) => {
        expect(typeof command).toBe("string")
        const state = container.childProcess._state

        let m = command.match(/systemctl is-active (.+)/)

        if (m) {
          return {
            stdout: state[m[1]],
            stderr: "",
          }
        }

        m = command.match(/sudo systemctl restart (.+)/)

        if (m) {
          state[m[1]] = "active"
          return {
            stdout: "",
            stderr: "",
          }
        }

        throw new Error()
      }),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
})

test("With service active", async () => {
  const asserter = new ServiceActive(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "service" }))
  ).resolves.toBe(true)
})

test("With service inactive", async () => {
  const asserter = new ServiceActive(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "otherService" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  await expect(asserter.result()).toEqual({ name: "otherService" })
})
