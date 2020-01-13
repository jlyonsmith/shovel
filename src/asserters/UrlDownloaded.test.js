import { UrlDownloaded } from "./UrlDownloaded"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import util, { PathInfo } from "../util"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    os: {
      userInfo: () => ({
        uid: 0,
        gid: 0,
      }),
    },
    util: {
      getUsers: async () => [
        { uid: 0, gid: 0, name: "root" },
        { uid: 10, gid: 10, name: "user1" },
        { uid: 20, gid: 10, name: "user2" },
      ],
      getGroups: async () => [
        { gid: 0, name: "root" },
        { gid: 10, name: "group1" },
        { gid: 20, name: "group2" },
      ],
      parseOwnerNode: util.parseOwnerNode,
      parseModeNode: util.parseModeNode,
      pathInfo: async (path) => {
        if (path === "/dir/somefile" || path === "/dir/badfile") {
          return new PathInfo(
            {
              isFile: () => true,
              isDirectory: () => false,
              size: 100,
              uid: 1,
              gid: 1,
              mode: 0o777,
            },
            container
          )
        } else if (path === "/dir") {
          return new PathInfo(
            {
              isFile: () => false,
              isDirectory: () => true,
              size: 0,
              uid: 1,
              gid: 1,
              mode: 0o777,
            },
            container
          )
        } else {
          return new PathInfo()
        }
      },
      generateDigestFromFile: async (path) => {
        if (path === "/dir/badfile") {
          return "0987654321"
        } else {
          return "1234567890"
        }
      },
    },
  }
  const testUrl = "http://localhost/somefile.txt"
  const asserter = new UrlDownloaded(container)

  // Missing/bad url
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { url: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing/bad digest
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "", digest: 1 }))
  ).rejects.toThrow(ScriptError)

  // Missing/bad file
  await expect(
    asserter.assert(createAssertNode(asserter, { url: "", digest: "" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { url: "", digest: "", file: 1 })
    )
  ).rejects.toThrow(ScriptError)

  // With correct file already in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest: "1234567890",
        file: "/dir/somefile",
      })
    )
  ).resolves.toBe(true)

  // With no file in place
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest: "1234567890",
        file: "/dir/missingfile",
      })
    )
  ).resolves.toBe(false)

  // With bad checksum
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        url: testUrl,
        digest: "1234567890",
        file: "/dir/badfile",
      })
    )
  ).resolves.toBe(false)
})

test("rectify", async () => {
  const container = {
    fs: {
      createWriteStream: jest.fn(() => ({})),
      remove: jest.fn(async (path) => null),
    },
    fetch: jest.fn(async (url) => ({})),
    util: {
      pipeToPromise: jest.fn(async () => undefined),
    },
  }
  const asserter = new UrlDownloaded(container)

  asserter.toFileExists = false
  asserter.expandedFile = "/foo/bar.txt"
  asserter.expandedUrl = "http://something.com"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.toFileExists = true

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new UrlDownloaded({})

  asserter.expandedFile = "/somedir/somefile.txt"

  expect(asserter.result()).toEqual({ file: asserter.expandedFile })
})
