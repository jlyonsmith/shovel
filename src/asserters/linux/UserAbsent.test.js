const UserAbsent = require("../UserAbsent")

test("assert", async (done) => {
  const asserter = new UserAbsent()

  expect(await asserter.assert({ name: "nonExistentUser" })).toBe(true)
  expect(await asserter.assert({ name: "existentUser" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new UserAbsent()
  const result = await asserter.actualize({ name: "nonExistentUser" })

  expect(result).toBe(true)
  done()
})
