import { PackageRemoved } from "./PackageRemoved"

let container = null

beforeEach(() => {
  container = {
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
        } else if (command.startsWith("apt remove")) {
          return {
            stdout: "",
            stderr: "",
          }
        } else {
          const e = new Error()
          e.code = 1
          throw e
        }
      }),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
})

test("With package removed", async () => {
  const asserter = new PackageRemoved(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "notthere" } })
  ).resolves.toBe(true)
})

test("With package not removed", async () => {
  const asserter = new PackageRemoved(container)

  await expect(
    asserter.assert({ name: { type: "string", value: "package" } })
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  await expect(asserter.result()).toEqual({ name: "package" })
})
