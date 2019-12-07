import { AutoToolProjectMade } from "./AutoToolProjectMade"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { PathInfo } from "../util"

test("assert", async () => {
  const container = {
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    expandStringNode: (node) => node.value,
    childProcess: {
      exec: async (command) => {
        if (command === "make") {
          return {}
        } else if (command.endsWith("bar")) {
          const error = new Error()

          error.code = 2
          throw error
        }
      },
    },
    util: {
      pathInfo: async (path) => {
        switch (path) {
          case "/xyz/Makefile":
            return new PathInfo(
              {
                isFile: () => true,
                uid: 1,
                gid: 1,
                mode: 0o777,
              },
              container
            )
          case "/notthere/Makefile":
            return new PathInfo(null, container)
        }
      },
    },
  }

  const asserter = new AutoToolProjectMade(container)

  // Bad command
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "", args: 1 }))
  ).rejects.toThrow(ScriptError)

  // All made
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/xyz" }))
  ).resolves.toBe(true)

  // All not made
  await expect(
    asserter.assert(
      createAssertNode(asserter, { directory: "/xyz", args: "bar" })
    )
  ).resolves.toBe(false)

  // No Makefile found
  await expect(
    asserter.assert(createAssertNode(asserter, { directory: "/notthere" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = { childProcess: {} }
  const asserter = new AutoToolProjectMade(container)

  // Good config
  container.childProcess.exec = async () => ({})
  asserter.expandedArgs = "bar"
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Bad config
  asserter.assertNode = createAssertNode(asserter, {})
  asserter.expandedArgs = ""
  container.childProcess.exec = async () => {
    throw new Error("unknown")
  }
  await expect(asserter.rectify()).rejects.toThrow(ScriptError)
})

test("result", () => {
  const asserter = new AutoToolProjectMade({})

  asserter.expandedDirectory = "blah"
  asserter.expandedArgs = "blah"

  expect(asserter.result()).toEqual({
    directory: asserter.expandedDirectory,
    args: asserter.expandedArgs,
  })
})
