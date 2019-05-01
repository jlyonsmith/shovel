import { DirectoryExistsAsserter } from "./DirectoryExistsAsserter"

test("assert", async (done) => {
  const asserter = new DirectoryExistsAsserter()

  expect(await asserter.assert({ path: "/somedir" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("run", async (done) => {
  const asserter = new DirectoryExistsAsserter()
  const result = await asserter.run({ path: "/somedir" })

  expect(result).toBe(true)
  done()
})
