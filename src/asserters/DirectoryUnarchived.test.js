import { DirectoryUnarchived } from "./DirectoryUnarchived"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      pathInfo: async (path) => undefined,
    },
  }
  const asserter = new DirectoryUnarchived(container)

  // With bad zip path
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { archive: 1 }))
  ).rejects.toThrow(ScriptError)

  // With bad path
  await expect(
    asserter.assert(createAssertNode(asserter, { archive: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { archive: "", directory: 1 }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const asserter = new DirectoryUnarchived({})
})

test("result", () => {})
