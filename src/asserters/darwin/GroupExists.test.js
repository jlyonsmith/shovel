const GroupExists = require("../GroupExists")

beforeEach(() => {
  // Set up some mocked out file info before each test
  require("child_process").__setMockFiles(MOCK_FILE_INFO)
})

test("assert", async (done) => {
  const asserter = new GroupExists()

  expect(await asserter.assert({ name: "groupName" })).toBe(true)
  expect(await asserter.assert({ name: "nonexistantGroupName" })).toBe(false)
  done()
})

test("actualize", async (done) => {
  const asserter = new GroupExists()
  const result = await asserter.actualize({ name: "groupName" })

  expect(result).toBe(true)
  done()
})
