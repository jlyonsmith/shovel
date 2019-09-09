import { UserExists } from "./UserExists"
import { createAssertNode } from "../testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
    util: {
      getUsers: jest.fn(async () => container._users),
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")

        const parts = path.split(" ")

        if (path.startsWith("useradd")) {
          container._users.push({
            name: parts[1],
            gid: 12,
            uid: 12,
            shell: "/bin/bash",
            homeDir: "/home/notthere",
            comment: "",
          })
        } else {
          const user = container._users.find((user) => user.name === parts[11])

          user.uid = parseInt(parts[2])
          user.gid = parseInt(parts[4])
          user.shell = parts[6]
          user.homeDir = parts[8]
          user.comment = parts[10].substring(1, parts[10].length - 1)
        }

        return 0
      }),
    },
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
    _users: [
      {
        name: "someuser",
        uid: 1,
        gid: 1,
        shell: "/bin/sh",
        homeDir: "/Users/someuser",
        comment: "",
      },
    ],
  }
})

test("With user existing", async () => {
  const asserter = new UserExists(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        name: "someuser",
      })
    )
  ).resolves.toBe(true)
})

test("With user existing with different gid, uid, shell, homeDir and comment", async () => {
  const asserter = new UserExists(container)

  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        name: "someuser",
        gid: 10,
        uid: 10,
        shell: "/bin/bash",
        homeDir: "/home/someuser",
        comment: "SomeUser",
      })
    )
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({
    name: "someuser",
    gid: 10,
    uid: 10,
    shell: "/bin/bash",
    homeDir: "/home/someuser",
    comment: "SomeUser",
  })
})

test("With user absent", async () => {
  const asserter = new UserExists(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  expect(asserter.result()).toEqual({
    name: "notthere",
    gid: 12,
    uid: 12,
    shell: "/bin/bash",
    homeDir: "/home/notthere",
    comment: "",
  })
})
