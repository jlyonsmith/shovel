import { FileContains } from "./FileContains"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError.js"
import { PathInfo } from "../util"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {
      readFile: jest.fn(async (path) => {
        if (path === "/somefile") {
          return "#start\ncontent\n#end"
        }
      }),
      outputFile: jest.fn(async (path, content) => undefined),
    },
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    util: {
      pathInfo: async (path) => {
        if (path === "/somefile") {
          return new PathInfo(
            { isFile: () => true, uid: 1, mode: 0o777 },
            container
          )
        } else if (path === "/missing") {
          return new PathInfo(null, container)
        }
      },
    },
  }

  const asserter = new FileContains(container)

  // Missing file
  await expect(
    asserter.assert(createAssertNode(asserter, { contents: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad file
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing contents
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "" }))
  ).rejects.toThrow(ScriptError)

  // Bad contents
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "", contents: 1 }))
  ).rejects.toThrow(ScriptError)

  // Bad position
  await expect(
    asserter.assert(
      createAssertNode(asserter, { file: "", contents: 1, position: 1 })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { file: "", contents: 1, position: "other" })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { file: "", contents: 1, position: "after" })
    )
  ).rejects.toThrow(ScriptError)

  // Bad regex
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "",
        contents: "",
        position: "over",
        regex: "[x",
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "",
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
        file: "/missing",
        contents: "xyz",
      })
    )
  ).rejects.toThrow(ScriptError)

  // Everything the same
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        contents: "#start\ncontent\n#end",
      })
    )
  ).resolves.toBe(true)

  // Contents different
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        contents: "#different",
      })
    )
  ).resolves.toBe(false)

  // With 'over' content included
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "over",
        regex: "^content$",
        contents: "content\n",
      })
    )
  ).resolves.toBe(true)

  // With 'over' and regexp match
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "over",
        regex: "^content$",
        contents: "Setting=yes\n",
      })
    )
  ).resolves.toBe(false)

  // With over an no regex match
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "over",
        regex: "^#foobar\n",
        contents: "foobar\n",
      })
    )
  ).resolves.toBe(false)

  // With 'before', regex match and content before
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "before",
        regex: "^#end",
        contents: "content\n",
      })
    )
  ).resolves.toBe(true)

  // With 'before', regex match and content not before
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "before",
        regex: "^#end",
        contents: "other\n",
      })
    )
  ).resolves.toBe(false)

  // With 'before' and no regex match
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "before",
        regex: "^#foobar",
        contents: "other\n",
      })
    )
  ).rejects.toThrow(ScriptError)

  // With 'after', regex match and content after
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "after",
        regex: "^#start\n",
        contents: "content\n",
      })
    )
  ).resolves.toBe(true)

  // With 'after', regex match and no content after
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "after",
        regex: "^#start$",
        contents: "other\n",
      })
    )
  ).resolves.toBe(false)

  // With 'after' and no regex match
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/somefile",
        position: "after",
        regex: "^#foobar",
        contents: "other\n",
      })
    )
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    fs: {
      outputFile: jest.fn(async () => undefined),
    },
  }
  const asserter = new FileContains(container)

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "xyz\n"
  asserter.fileContents = "#start\ncontent\n#end"

  // Before
  asserter.position = "before"
  asserter.firstIndex = asserter.fileContents.indexOf("#end")
  asserter.lastIndex = asserter.fileContents.length
  container.fs.outputFile = async (fileName, data) => {
    expect(data).toBe("#start\ncontent\nxyz\n#end")
  }
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // After
  asserter.position = "after"
  asserter.firstIndex = asserter.fileContents.indexOf("#start")
  asserter.lastIndex = asserter.fileContents.indexOf("content")
  container.fs.outputFile = async (fileName, data) => {
    expect(data).toBe("#start\nxyz\ncontent\n#end")
  }
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // Over
  asserter.position = "over"
  asserter.firstIndex = asserter.fileContents.indexOf("content\n")
  asserter.lastIndex = asserter.fileContents.indexOf("#end")
  container.fs.outputFile = async (fileName, data) => {
    expect(data).toBe("#start\nxyz\n#end")
  }
  await asserter.rectify()
  await expect(asserter.rectify()).resolves.toBeUndefined()

  // All
  asserter.position = "all"
  container.fs.outputFile = async (fileName, data) => {
    expect(data).toBe("xyz\n")
  }
  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new FileContains({})

  asserter.expandedPath = "/somefile.txt"
  asserter.expandedContents = "some contents"

  expect(asserter.result()).toEqual({
    file: asserter.expandedPath,
    contents: asserter.expandedContents,
  })
})
