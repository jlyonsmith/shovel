import { GroupExists } from "./GroupExists"

let container = null

beforeEach(() => {
  container = {
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

test("With group existing", async () => {
  const asserter = new GroupExists(container)

  await expect(asserter.assert({ name: "mail" })).resolves.toBe(true)
})

test("With group absent", async () => {
  const asserter = new GroupExists(container)

  await expect(asserter.assert({ name: "notthere" })).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
