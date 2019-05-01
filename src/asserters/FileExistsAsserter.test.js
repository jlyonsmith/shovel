import { FileExistsAsserter } from "./FileExistsAsserter"
import { getMockFS } from "./mocks"

test("assert", async (done) => {
  const mock = getMockFS()
  const asserter = new FileExistsAsserter({ fs: mock })

  expect(await asserter.assert({ path: "/somefile" })).toBe(true)
  expect(await asserter.assert({ path: "/notthere" })).toBe(false)
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new FileExistsAsserter({ fs: mock })
  const result = await asserter.run({ path: "/somefile" })

  expect(result).toBe(true)
  // TODO: ...

  done()
})
