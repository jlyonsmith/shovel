import { UserDisabled } from "./UserDisabled"

let container = null

beforeEach(() => {
  container = {
    assertNode: { line: 0, column: 0 },
    expandStringNode: (node) => node.value,
    fs: {
      readFile: jest.fn(async (filePath) => {
        expect(typeof filePath).toBe("string")
        return `lxd:*:17941:0:99999:7:::
uuidd:*:17941:0:99999:7:::
dnsmasq:*:17941:0:99999:7:::
landscape:*:17941:0:99999:7:::
pollinate:*:17941:0:99999:7:::
realuser:$6$nrnXn0vExLOZH.Ad$OEMTYVv1gyz/j4gCHqZGLyLtfXaSbfC7zyfo0pVDKi07qq/dyuqOurFAb3M522nynovdLiM2kb1sBei9aDWnN/:18010:0:99999:7:::
sshd:*:18010:0:99999:7:::
ntp:*:18010:0:99999:7:::
enabled:!:18113:0:99999:7:::
disabled:!:18113:0:99999:7::1:`
      }),
    },
    childProcess: {
      exec: jest.fn(async (path) => {
        expect(typeof path).toBe("string")
        return {
          stdout: "",
          stderr: "",
        }
      }),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
})

test("With user disabled", async () => {
  const asserter = new UserDisabled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "disabled" } })
  ).resolves.toBe(true)
})

test("With user enabled", async () => {
  const asserter = new UserDisabled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "enabled" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
})
