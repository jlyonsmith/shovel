import { jest } from "@jest/globals"
import { ScriptError } from "./ScriptError.js"

test("create script error", async () => {
  const error = new ScriptError("message", "/somefile.js")

  expect(error.toString()).toBe(error.message)
})
