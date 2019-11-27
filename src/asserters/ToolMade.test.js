import { ToolMade } from "./ToolMade"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {},
    fs: {},
  }

  const asserter = new ToolMade(container)

  // Bad command
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "", command: 1 }))
  ).rejects.toThrow(ScriptError)

  // All configured
  await expect(
    asserter.assert(
      createAssertNode(asserter, { directory: "/xyz", command: "" })
    )
  ).resolves.toBe(true)

  // Not configured
  await expect(
    asserter.assert(
      createAssertNode(asserter, { directory: "/abc", command: "" })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: async () => ({
        stdout: "failed",
      }),
    },
  }
  const asserter = new MakeConfigured(container)

  // Good config
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Bad config
  await expect(asserter.rectify()).rejects.toThrow(ScriptError)
})

test("result", () => {
  const asserter = new MakeConfigured({})

  asserter.commandDirectory = "blah"
  asserter.expandedCommand = "blah"

  expect(asserter.result()).toEqual({
    directory: asserter.commandDirectory,
    command: asserter.expandedCommand,
  })
})
