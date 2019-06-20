import { FileContains } from "./FileContains"

let container = null

beforeAll(() => {
  container = {
    fs: {
      copy: jest.fn(async (fileName) => null),
    },
  }
})

test("FileContains with file existing", async () => {
  const asserter = new FileContains(container)

  await expect(asserter.assert({ path: "/somefile" })).resolves.toBe(true)
})

test("FileContains with no file or dir existing", async () => {
  const asserter = new FileContains(container)

  await expect(asserter.assert({ path: "/notthere" })).resolves.toBe(false)
  await expect(
    asserter.actualize({ path: "/notthere" })
  ).resolves.toBeUndefined()
})

test("FileContains with dir instead of file existing", async () => {
  const asserter = new FileContains(container)

  await expect(asserter.assert({ path: "/somedir" })).resolves.toBe(false)
  await expect(asserter.actualize({ path: "/somedir" })).rejects.toThrow(Error)
})
