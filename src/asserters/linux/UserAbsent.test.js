import { UserAbsent } from "./UserAbsent"

let container = null

beforeEach(() => {
  container = {
    fs: {
      readFile: jest.fn(async (filePath) => {
        expect(typeof filePath).toBe("string")
        return `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin`
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

test("With user absent", async () => {
  const asserter = new UserAbsent(container)

  await expect(asserter.assert({ name: "notthere" })).resolves.toBe(true)
})

test("With user present", async () => {
  const asserter = new UserAbsent(container)

  await expect(asserter.assert({ name: "games" })).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
