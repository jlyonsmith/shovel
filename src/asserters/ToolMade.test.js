import { ToolMade } from "./ToolMade"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {
      exec: async (command) => {
        if (command.endsWith("foo")) {
          return {}
        } else if (command.endsWith("bar")) {
          const error = new Error()

          error.code = 2
          throw error
        }
      },
    },
    util: {
      pathInfo: () => ({
        access: "rw",
      }),
    },
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
    asserter.assert(createAssertNode(asserter, { directory: "", target: 1 }))
  ).rejects.toThrow(ScriptError)

  // All made
  await expect(
    asserter.assert(
      createAssertNode(asserter, { directory: "/xyz", target: "foo" })
    )
  ).resolves.toBe(true)

  // All not made
  await expect(
    asserter.assert(
      createAssertNode(asserter, { directory: "/xyz", target: "bar" })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = { childProcess: {} }
  const asserter = new ToolMade(container)

  // Good config
  container.childProcess.exec = async () => ({})
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Bad config
  asserter.assertNode = createAssertNode(asserter, {})
  container.childProcess.exec = async () => {
    throw new Error("unknown")
  }
  await expect(asserter.rectify()).rejects.toThrow(ScriptError)
})

test("result", () => {
  const asserter = new ToolMade({})

  asserter.expandedDirectory = "blah"
  asserter.expandedTarget = "blah"

  expect(asserter.result()).toEqual({
    directory: asserter.expandedDirectory,
    target: asserter.expandedTarget,
  })
})
