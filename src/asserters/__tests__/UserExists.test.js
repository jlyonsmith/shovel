import { UserExists } from "../UserExists"

test("assert", async (done) => {
  const asserter = new UserExists()

  expect(await asserter.assert({ name: "existentUser" })).toBe(true)
  expect(await asserter.assert({ name: "nonExistentUser" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new UserExists()
  const result = await asserter.actualize({ name: "existentUser" })

  expect(result).toBe(true)
  done()
})
