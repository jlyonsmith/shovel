import { UserExists } from "./UserExists.js"
import { createAssertNode } from "../testUtil.js"
import { ScriptError } from "../ScriptError.js"

let container = null

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    util: {
      runningAsRoot: () => true,
      getUsers: async () => [
        {
          name: "user1",
          uid: 1,
          gid: 1,
          shell: "/bin/sh",
          homeDir: "/users/user1",
          comment: "",
        },
      ],
    },
  }

  const asserter = new UserExists(container)

  // Bad args
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { user: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "x", uid: "1" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "x", gid: "1" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "x", shell: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "x", homeDir: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "x", comment: 1 }))
  ).rejects.toThrow(ScriptError)

  // With user existing
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
      })
    )
  ).resolves.toBe(true)

  // With user existing with different stuff
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        gid: 2,
      })
    )
  ).resolves.toBe(false)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        uid: 2,
      })
    )
  ).resolves.toBe(false)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        shell: "/bin/bash",
      })
    )
  ).resolves.toBe(false)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        homeDir: "/home/user1",
      })
    )
  ).resolves.toBe(false)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        comment: "User1",
      })
    )
  ).resolves.toBe(false)

  // With user absent
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "notthere" }))
  ).resolves.toBe(false)

  // With user absent and not root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(createAssertNode(asserter, { user: "notthere" }))
  ).rejects.toThrow(ScriptError)

  // With user different and not root
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        user: "user1",
        gid: 2,
      })
    )
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const users = [
    {
      name: "user1",
      gid: 12,
      uid: 12,
      shell: "/bin/bash",
      homeDir: "/home/user1",
      comment: "",
    },
    {
      name: "user2",
    },
  ]
  const container = {
    childProcess: {
      exec: async () => undefined,
    },
    util: {
      getUsers: async () => users,
    },
  }
  const asserter = new UserExists(container)

  asserter.modify = false
  asserter.expandedName = "user1"
  asserter.user = users[0]
  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.modify = true
  asserter.expandedName = "badname"
  asserter.user = users[1]
  await expect(asserter.rectify()).rejects.toThrow(Error)
})

test("result", () => {
  const asserter = new UserExists({})

  asserter.user = {
    name: "user1",
    gid: 12,
    uid: 12,
    shell: "/bin/bash",
    homeDir: "/home/user1",
    comment: "",
  }

  expect(asserter.result()).toEqual(asserter.user)
})
