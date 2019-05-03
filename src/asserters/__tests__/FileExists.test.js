import { FileExists } from "../FileExists"

test("assert", async (done) => {
  const asserter = new FileExists()

  expect(await asserter.assert({ path: "/somefile" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new FileExists()
  const result = await asserter.actualize({ path: "/somefile" })

  expect(result).toBe(true)
  done()
})