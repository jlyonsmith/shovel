import { GroupExists } from "../GroupExists"

test("assert", async (done) => {
  const asserter = new GroupExists()

  expect(await asserter.assert({ name: "existentGroup" })).toBe(true)
  expect(await asserter.assert({ name: "nonExistentGroup" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new GroupExists()
  const result = await asserter.actualize({ name: "existentGroup" })

  expect(result).toBe(true)
  done()
})
