import { jest } from "@jest/globals"
import { UserDisabled } from "./UserDisabled.js"
import { createAssertNode } from "../testUtil.js"
import { ScriptError } from "../ScriptError.js"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {
      readFile: jest.fn(async (filePath) => {
        expect(typeof filePath).toBe("string")
        return `lxd:*:17941:0:99999:7:::
uuidd:*:17941:0:99999:7:::
dnsmasq:*:17941:0:99999:7:::
landscape:*:17941:0:99999:7:::
pollinate:*:17941:0:99999:7:::
realuser:$6$nrnXn0vExLOZH.Ad$OEMTYVv1gyz/j4gCHqZGLyLtfXaSbfC7zyfo0pVDKi07qq/dyuqOurFAb3M522nynovdLiM2kb1sBei9aDWnN/:18010:0:99999:7:::
sshd:*:18010:0:99999:7:::
ntp:*:18010:0:99999:7:::
enabled:!:18113:0:99999:7:::
disabled:!:18113:0:99999:7::1:`
      }),
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return {
          stdout: "",
          stderr: "",
        }
      }),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }

  const asserter = new UserDisabled(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { user: 1 }))
  ).rejects.toThrow(ScriptError)

  // With user disabled
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "disabled" }))
  ).resolves.toBe(true)

  // With user enabled
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "enabled" }))
  ).resolves.toBe(false)

  // With user enabled and not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "enabled" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => undefined,
    },
  }
  const asserter = new UserDisabled(container)

  asserter.expandedName = "blah"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new UserDisabled({})

  asserter.expandedName = "blah"

  expect(asserter.result()).toEqual({ user: asserter.expandedName })
})
