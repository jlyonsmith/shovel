import { ScriptError } from "./ScriptError"

test("create script error", async () => {
  const error = new ScriptError("message", "/somefile.js")

  expect(error.toString()).toBe(error.message)
})
