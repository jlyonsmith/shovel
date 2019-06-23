import { FileContains } from "./FileContains"
import stream from "stream"

let container = null
const testString = "The quick brown fox jumps over the lazy dog\n"

beforeEach(() => {
  container = {
    fs: {
      createReadStream: jest.fn((fileName) => {
        expect(typeof fileName).toBe("string")
        return new stream.Readable({
          read(size) {
            this.push(testString)
            this.push(null)
          },
        })
      }),
      outputFile: jest.fn(async (fileName, data) => {
        expect(typeof fileName).toBe("string")
        expect(typeof data).toBe("string")
      }),
    },
  }
})

test("FileContains with same contents", async () => {
  const asserter = new FileContains(container)

  await expect(
    asserter.assert({
      path: "/somefile",
      contents: testString,
    })
  ).resolves.toBe(true)
})

test("FileContains with different contents", async () => {
  const asserter = new FileContains(container)

  await expect(
    asserter.assert({
      path: "/somefile",
      contents: "anything but the test string",
    })
  ).resolves.toBe(false)
  await expect(asserter.actualize()).resolves.toBeUndefined()
})
