const FileAbsent = require("../FileAbsent")

test("assert", async (done) => {
  const asserter = new FileAbsent()

  expect(await asserter.assert({ path: "/notthere" })).toBe(true)
  expect(await asserter.assert({ path: "/somefile" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new FileAbsent()
  const result = await asserter.actualize({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})
