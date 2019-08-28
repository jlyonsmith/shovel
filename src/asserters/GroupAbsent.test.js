import { GroupAbsent } from "./GroupAbsent"
import { createAssertNode } from "./testUtil"
import { ScriptError } from "../ScriptError"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    fs: {
      readFile: jest.fn(async (filePath) => {
        expect(typeof filePath).toBe("string")
        return `root:x:0:
daemon:x:1:
bin:x:2:
sys:x:3:
tty:x:5:
disk:x:6:
lp:x:7:
mail:x:8:
news:x:9:`
      }),
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return 0
      }),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
  }
})

test("With group absent", async () => {
  const asserter = new GroupAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(true)
})

test("With group present", async () => {
  const asserter = new GroupAbsent(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "news" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
