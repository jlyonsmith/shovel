import { FileIsAbsentAsserter } from "./FileIsAbsentAsserter"
import fs from "fs-extra"

function getMockFS() {
  return {
    lstat: jest.fn(),
    unlink: jest.fn(),
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
  const asserter = new FileIsAbsentAsserter({ fs: mock })
  const result = await asserter.assert({ path: "/notthere" })

  expect(result).toBe(true)
  done()
})

test("run", async (done) => {
  const mock = getMockFS()
  const asserter = new FileIsAbsentAsserter({ fs: mock })
  const result = await asserter.run({ path: "/test" })

  expect(result).toBe(true)
  // TODO: ...

  done()
})
