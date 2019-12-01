import { TarFileExtracted } from "./TarFileExtracted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    util: {
      pathInfo: async (path) => undefined,
    },
  }
  const asserter = new TarFileExtracted(container)

  // With bad zip path
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // With bad path
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "", toDirectory: 1 }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const asserter = new TarFileExtracted({})
})

test("result", () => {})
