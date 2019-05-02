import { FileAbsent } from "../FileAbsent"

test("assert", async (done) => {
  const asserter = new FileAbsent()

  expect(await asserter.assert({ path: "/notthere" })).toBe(true)
  expect(await asserter.assert({ path: "/somefile" })).toBe(false)
  done()
})

test("run", async (done) => {
  const asserter = new FileAbsent()
  const result = await asserter.run({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})
