import { DirectoryAbsent } from "../DirectoryAbsent"

test("assert", async (done) => {
  const asserter = new DirectoryAbsent()

  expect(await asserter.assert({ path: "/notthere" })).toBe(true)
  expect(await asserter.assert({ path: "/somedir" })).toBe(false)
  done()
})

test("run", async (done) => {
  const asserter = new DirectoryAbsent()
  const result = await asserter.run({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})
