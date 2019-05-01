import { FileExistsAsserter } from "./FileExistsAsserter"

export function getMockFS() {
  return {
    lstat: jest.fn((path) => {
      if (path === "/somefile") {
        return Promise.resolve({ isFile: () => true, isDirectory: () => false })
      } else if (path === "/somedir") {
        return Promise.resolve({ isDirectory: () => true, isFile: () => false })
      } else {
        return Promise.reject(new Error())
      }
    }),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  }
}

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
