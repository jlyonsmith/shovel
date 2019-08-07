import { PackageInstalled } from "./PackageInstalled"

let container = null

beforeEach(() => {
  container = {
    newScriptError: (message, node) => {
      expect(typeof message).toBe("string")
      expect(typeof node).toBe("object")
      return new Error(message)
    },
    expandStringNode: (node) => node.value,
    withNode: { line: 0, column: 0 },
    assertNode: { line: 0, column: 0 },
    childProcess: {
      exec: jest.fn(async (command) => {
        expect(typeof command).toBe("string")

        if (command === "dpkg --list package") {
          return {
            stdout: `Desired=Unknown/Install/Remove/Purge/Hold
| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend
|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)
||/ Name                       Version            Architecture       Description
+++-==========================-==================-==================-=========================================================
ii  package                    1:2.3.xyz          amd64              Some package or other`,
            stderr: "",
          }
        } else if (command.startsWith("dpkg")) {
          const e = new Error()
          e.code = 1
          throw e
        } else if (command === "apt install -y package") {
          return {
            stdout: "",
            stderr: "",
          }
        }
      }),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
})

test("With package installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "package" } })
  ).resolves.toBe(true)
})

test("With package not installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "notthere" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  await expect(asserter.result()).toEqual({ name: "notthere" })
})
