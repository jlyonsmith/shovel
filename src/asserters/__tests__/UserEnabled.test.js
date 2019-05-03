import { UserEnabled } from "../UserEnabled"

test("assert", async (done) => {
  const asserter = new UserEnabled()

  expect(await asserter.assert({ name: "enabledUser" })).toBe(true)
  expect(await asserter.assert({ name: "disabledUser" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new UserEnabled()
  const result = await asserter.actualize({ name: "enabledUser" })

  expect(result).toBe(true)
  done()
})
