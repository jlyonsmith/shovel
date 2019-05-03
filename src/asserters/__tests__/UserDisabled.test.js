import { UserDisabled } from "../UserDisabled"

test("assert", async (done) => {
  const asserter = new UserDisabled()

  expect(await asserter.assert({ name: "disabledUser" })).toBe(true)
  expect(await asserter.assert({ name: "enabledUser" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new UserDisabled()
  const result = await asserter.actualize({ name: "disabledUser" })

  expect(result).toBe(true)
  done()
})
