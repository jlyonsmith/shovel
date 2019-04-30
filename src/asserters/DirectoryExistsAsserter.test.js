import { DirectoryExistsAsserter } from "./DirectoryExistsAsserter"
import fs from "fs-extra"

function getMockFS() {
  return {
    lstat: jest.fn(),
    mkdir: jest.fn(),
  }
}

function getOutput(fn) {
  const calls = fn.mock.calls
  if (calls.length > 0 && calls[0].length > 0) {
    return calls[0][0]
  } else {
    return ""
  }
}

test("assert", async (done) => {
  const mock = getMockFS()
  const asserter = new DirectoryExistsAsserter({ fs: mock })
  const result = await asserter.assert({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new DirectoryExistsAsserter({ fs: mock })
  const result = await asserter.run({ path: "/test" })

  // TODO: ...

  done()
})
