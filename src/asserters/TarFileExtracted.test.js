import { TarFileExtracted } from "./TarFileExtracted"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { Readable, Writable } from "stream"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    fs: {
      createReadStream: jest.fn((path) => {
        switch (path) {
          case "/xyz/some.tar":
            return new Readable({
              read(size) {
                this.push("entry1")
                this.push(null)
              },
            })
          case "/xyz/other.tar":
            return new Readable({
              read(size) {
                this.push("entry2")
                this.push(null)
              },
            })
        }
      }),
    },
    util: {
      pathInfo: async (path) => {
        switch (path) {
          case "/xyz/file1.txt":
          case "/xyz/file2.txt":
            return {
              size: 100,
            }
          case "/xyz":
          case "/xyz/some.tar":
            return {
              getAccess: () => ({
                isReadWrite: () => true,
                isReadable: () => true,
              }),
            }
          case "/unreadable":
          case "/xyz/unreadable.tar":
            return {
              getAccess: () => ({
                isReadWrite: () => false,
                isReadable: () => false,
              }),
            }
        }
      },
    },
    tar: {
      Parse: class extends Writable {
        _write(chunk, encoding, callback) {
          const entry = chunk.toString()

          switch (entry) {
            case "entry1":
              this.emit("entry", { path: "file1.txt", size: 100 }) // Same as disk
            case "entry2":
              this.emit("entry", { path: "file2.txt", size: 50 }) // Different from disk
          }

          callback()
        }
      },
    },
  }
  const asserter = new TarFileExtracted(container)

  // With bad file path
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { file: 1 }))
  ).rejects.toThrow(ScriptError)

  // With bad directory
  await expect(
    asserter.assert(
      createAssertNode(asserter, { file: "/xyz/some.tar", toDirectory: 1 })
    )
  ).rejects.toThrow(ScriptError)

  // Unreadable tar
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/xyz/unreadable.tar" }))
  ).rejects.toThrow(ScriptError)

  // Unreadable directory
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        file: "/xyz/some.tar",
        toDirectory: "/unreadable",
      })
    )
  ).rejects.toThrow(ScriptError)

  // No changes
  await expect(
    asserter.assert(createAssertNode(asserter, { file: "/xyz/some.tar" }))
  ).resolves.toBe(true)
})

test("rectify", async () => {
  const container = {
    tar: {
      x: async () => undefined,
    },
  }
  const asserter = new TarFileExtracted(container)

  asserter.expandedFile = ""
  asserter.expandedDirectory = ""

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new TarFileExtracted({})

  asserter.expandedFile = "some.tar"
  asserter.expandedDirectory = ""

  expect(asserter.result()).toEqual({
    file: asserter.expandedFile,
    toDirectory: asserter.expandedDirectory,
  })
})
