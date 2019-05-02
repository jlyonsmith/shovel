import { FileAbsentAsserter } from "../FileAbsentAsserter"

test("assert", async (done) => {
  const asserter = new FileAbsentAsserter()

  expect(await asserter.assert({ path: "/notthere" })).toBe(true)
  expect(await asserter.assert({ path: "/somefile" })).toBe(false)
  done()
})

test("run", async (done) => {
  const asserter = new FileAbsentAsserter()
  const result = await asserter.run({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})
