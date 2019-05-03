import { GroupAbsent } from "../GroupAbsent"

test("assert", async (done) => {
  const asserter = new GroupAbsent()

  expect(await asserter.assert({ name: "nonExistentGroup" })).toBe(true)
  expect(await asserter.assert({ name: "groupName" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new GroupAbsent()
  const result = await asserter.actualize({ name: "nonExistentGroup" })

  expect(result).toBe(true)
  done()
})
