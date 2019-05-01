import { DirectoryExistsAsserter } from "./DirectoryExistsAsserter"
import { getMockFS } from "./mocks"

test("assert", async (done) => {
  const mock = getMockFS()
  const asserter = new DirectoryExistsAsserter({ fs: mock })

  expect(await asserter.assert({ path: "/somedir" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new DirectoryExistsAsserter({ fs: mock })
  const result = await asserter.run({ path: "/somedir" })

  expect(result).toBe(true)
  // TODO: ...

  done()
})
