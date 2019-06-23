import { FileUnzipped } from "./FileUnzipped"
import stream from "stream"

let container = null

beforeEach(() => {
  container = {
    fs: {
      createReadStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")

        return new stream.Readable({
          read(size) {
            if (fileName === "/badfile") {
              this.push("not the test string")
            } else {
              this.push("The quick brown fox jumps over the lazy dog\n")
            }
            this.push(null)
          },
        })
      }),
      lstat: jest.fn(async (path) => {
        if (path === "/somefile" || path === "/otherfile") {
          return {
            isDirectory: jest.fn(() => false),
            isFile: jest.fn(() => true),
          }
        } else {
          throw new Error("ENOENT")
        }
      }),
      ensureDir: jest.fn(async (dirPath) => {
        expect(typeof dirPath).toBe("string")
      }),
    },
  }
})

test("With all files unzipped and the same", async () => {
  const asserter = new FileUnzipped(container)

  await expect(
    asserter.assert({ zipPath: "./somefile.zip", toPath: "./outdir" })
  ).resolves.toBe(true)
  expect(container.fs.createReadStream).toHaveBeenCalledTimes(2)
})

test("With output directory missing", async () => {
  const asserter = new FileUnzipped(container)

  await expect(
    asserter.assert({ zipPath: "./somefile.zip", toPath: "./outdir" })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("With output directory and some files different", async () => {
  const asserter = new FileUnzipped(container)

  await expect(
    asserter.assert({ zipPath: "./somefile.zip", toPath: "./outdir" })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})

test("With output directory and some files missing", async () => {
  const asserter = new FileUnzipped(container)

  await expect(
    asserter.assert({ zipPath: "./somefile.zip", toPath: "./outdir" })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
