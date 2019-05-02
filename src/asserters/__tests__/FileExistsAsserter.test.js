import { FileExistsAsserter } from "../FileExistsAsserter"

test("assert", async (done) => {
  const asserter = new FileExistsAsserter()

  expect(await asserter.assert({ path: "/somefile" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("run", async (done) => {
  const asserter = new FileExistsAsserter()
  const result = await asserter.run({ path: "/somefile" })

  expect(result).toBe(true)
  done()
})
