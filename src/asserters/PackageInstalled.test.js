import { PackageInstalled } from "./PackageInstalled"
import { createAssertNode } from "./testUtil"

let container = null

beforeEach(() => {
  container = {
    expandStringNode: (node) => node.value,
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
        } else if (command.startsWith("apt install")) {
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

test("With package installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "package" }))
  ).resolves.toBe(true)
})

test("With package not installed", async () => {
  const asserter = new PackageInstalled(container)

  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)
  await expect(asserter.rectify()).resolves.toBeUndefined()
  await expect(asserter.result()).toEqual({ name: "notthere" })
})
