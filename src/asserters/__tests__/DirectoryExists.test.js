import { DirectoryExists } from "../DirectoryExists"

test("assert", async (done) => {
  const asserter = new DirectoryExists()

  expect(await asserter.assert({ path: "/somedir" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new DirectoryExists()
  const result = await asserter.actualize({ path: "/somedir" })

  expect(result).toBe(true)
  done()
})
