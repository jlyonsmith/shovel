import * as util from "./util"

let container = null

beforeEach(() => {
  container = {
    fs: {
      lstat: jest.fn((path) => {
        if (path === "somedir") {
          return {
            isDirectory: () => true,
          }
        } else {
          return {
            isDirectory: () => false,
          }
        }
      }),
    },
    childProcess: {},
    os: {
      userInfo: jest.fn(() => ({
        uid: 0,
      })),
    },
  }
})

test("running as root", async () => {
  expect(util.runningAsRoot(container.os)).toBe(true)
})

test("directory existing", async () => {
  await expect(util.dirExists(container.fs, "somedir")).resolves.toBe(true)
})

test("directory not existing", async () => {
  await expect(util.dirExists(container.fs, "notthere")).resolves.toBe(false)
})
