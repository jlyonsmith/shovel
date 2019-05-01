import { FileAbsentAsserter } from "./FileAbsentAsserter"
import { getMockFS } from "./FileExistsAsserter.test"

test("assert", async (done) => {
  const mock = getMockFS()
  const asserter = new FileAbsentAsserter({ fs: mock })
  expect(await asserter.assert({ path: "/notthere" })).toBe(true)
  expect(await asserter.assert({ path: "/somefile" })).toBe(false)
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new FileAbsentAsserter({ fs: mock })
  const result = await asserter.run({ path: "/notthere" })

  expect(result).toBe(true)
  // TODO: ...

  done()
})
