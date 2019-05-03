import { GroupExists } from "../GroupExists"
const MOCK_FILE_INFO = {
  existentGroup: () => true,
  nonExistentGroup: () => false,
}

beforeEach(() => {
  // Set up some mocked out file info before each test
  require("../__mocks__/child_process").__setMockFiles(MOCK_FILE_INFO)
})

test("assert", async (done) => {
  const asserter = new GroupExists()

  expect(await asserter.assert({ name: "existentGroup" })).toBe(true)
  expect(await asserter.assert({ name: "nonExistentGroup" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new GroupExists()
  const result = await asserter.actualize({ name: "existentGroup" })

  expect(result).toBe(true)
  done()
})
