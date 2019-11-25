import { FileContains } from "./FileContains"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    fs: {
      readFile: jest.fn(async (path) => {
        if (path === "/somefile") {
          return "#start\ncontent\n#end"
        }
      }),
      outputFile: jest.fn(async (path, content) => undefined),
    },
    util: {
      pathInfo: async (path) => {
        if (path === "/somefile") {
          return { type: "f", access: "rw" }
        } else if (path === "/missing") {
          return { type: "-", access: "--" }
        }
      },
      canAccess: jest.fn(async () => true),
    },
  }

  const asserter = new FileContains(container)

  // Missing path
  await expect(
    asserter.assert(createAssertNode(asserter, { contents: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad path
  await expect(
    asserter.assert(createAssertNode(asserter, { path: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing contents
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad contents
  await expect(
    asserter.assert(createAssertNode(asserter, { path: "", contents: 1 }))
  ).rejects.toThrow(ScriptError)

  // Bad position
  await expect(
    asserter.assert(
      createAssertNode(asserter, { path: "", contents: 1, position: 1 })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { path: "", contents: 1, position: "other" })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { path: "", contents: 1, position: "after" })
    )
  ).rejects.toThrow(ScriptError)

  // Bad regex
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "",
        contents: "",
        position: "over",
        regex: "[x",
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "",
        contents: "",
        position: "over",
        regex: 1,
      })
    )
  ).rejects.toThrow(ScriptError)

  // File missing or inaccessible
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/missing",
        contents: "xyz",
      })
    )
  ).rejects.toThrow(ScriptError)

  // Everything the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        contents: "#start\ncontent\n#end",
      })
    )
  ).resolves.toBe(true)

  // Contents different
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        contents: "#different",
      })
    )
  ).resolves.toBe(false)

  // With explicit 'over'
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "over",
        regex: "^content$",
        contents: "Setting=yes\n",
      })
    )
  ).resolves.toBe(false)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "over",
        regex: "^#foobar\n",
        contents: "foobar\n",
      })
    )
  ).rejects.toThrow(ScriptError)

  // With 'before'
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "before",
        regex: "^#end",
        contents: "content\n",
      })
    )
  ).resolves.toBe(true)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "before",
        regex: "^#end",
        contents: "other\n",
      })
    )
  ).resolves.toBe(false)

  // With 'after'
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "after",
        regex: "^#start\n",
        contents: "content\n",
      })
    )
  ).resolves.toBe(true)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        path: "/somefile",
        position: "after",
        regex: "^#start$",
        contents: "other\n",
      })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = {
    fs: {
      outputFile: jest.fn(async (fileName, data) => {
        expect(typeof fileName).toBe("string")
        expect(typeof data).toBe("string")
      }),
    },
  }
  const asserter = new FileContains(container)

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "some contents"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileContains({})

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "some contents"

  expect(asserter.result()).toEqual({
    path: asserter.expandedPath,
    contents: asserter.expandedContents,
  })
})
