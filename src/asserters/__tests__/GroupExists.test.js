<<<<<<< HEAD
var GroupExists = require("../GroupExists")
=======
import { GroupExists } from "../GroupExists"
>>>>>>> origin

test("assert", async (done) => {
  const asserter = new GroupExists()

<<<<<<< HEAD
  expect(await asserter.assert({ name: "groupName" })).toBe(true)
  expect(await asserter.assert({ name: "nonexistantGroupName" })).toBe(false)
=======
  expect(await asserter.assert({ name: "existentGroup" })).toBe(true)
  expect(await asserter.assert({ name: "nonExistentGroup" })).toBe(false)
>>>>>>> origin
  done()
})

test("actualize", async (done) => {
  const asserter = new GroupExists()
<<<<<<< HEAD
  const result = await asserter.actualize({ name: "groupName" })
=======
  const result = await asserter.actualize({ name: "existentGroup" })
>>>>>>> origin

  expect(result).toBe(true)
  done()
})
