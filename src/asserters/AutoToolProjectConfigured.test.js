import { AutoToolProjectConfigured } from "./AutoToolProjectConfigured"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {},
    util: {
      pathInfo: async (path) => {
        switch (path) {
          case "/xyz/configure":
            return {
              getAccess: () => ({
                isReadable: () => true,
              }),
            }
          case "/xyz/config.status":
            return {
              isFile: () => true,
            }
          case "/abc/configure":
            return {
              getAccess: () => ({
                isReadable: () => false,
              }),
            }
        }
      },
      runningAsRoot: jest.fn(() => true),
    },
  }

  const asserter = new AutoToolProjectConfigured(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "", args: 1 }))
  ).rejects.toThrow(ScriptError)

  // All configured
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/xyz", args: "" }))
  ).resolves.toBe(true)

  // config not found
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/abc" }))
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
  const asserter = new AutoToolProjectConfigured(container)

  asserter.expandedDirectory = "/xyz"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new AutoToolProjectConfigured({})

  asserter.expandedDirectory = "blah"
  asserter.expandedArgs = "blah"

  expect(asserter.result()).toEqual({
    directory: asserter.expandedDirectory,
    args: asserter.expandedArgs,
  })
})
