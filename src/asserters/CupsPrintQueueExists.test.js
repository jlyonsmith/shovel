import { CupsPrintQueueExists } from "./CupsPrintQueueExists"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"
import { PathAccess, PathInfo } from "../util"

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    process: {
      geteuid: () => 1,
      getgroups: () => [1, 2],
    },
    util: {
      runningAsRoot: () => true,
      osInfo: async () => ({
        platform: "linux",
        id: "centos"
      }),
      pathInfo: async (path) => {
        if (
          path === "/etc/cups/ppd/printer1.ppd" ||
          path === "/usr/local/drivers/printer1.ppd" ||
          path === "/etc/cups/lpoptions" ||
          path === "/etc/cups/printers.conf" ||
          path === "/usr/local/drivers/other.ppd"
        ) {
          return new PathInfo(
            {
              isFile: () => true,
              size: 100,
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
    },
    fs: {
      readFile: (file) => {
        if (file === "/etc/cups/printers.conf") {
          return `
<Printer printer1>
DeviceURI serial:/dev/usb/lp0
ErrorPolicy abort-job
Shared True
Accepting True
</Printer>
<Printer printer2>
DeviceURI serial:/dev/usb/lp1
ErrorPolicy abort-job
Shared False
Accepting False
Location Nowhere
Info HP Laserjet 600XL
</Printer>`
        } else if (file === "/etc/cups/lpoptions") {
          return `
Dest printer1 PrintBothSides=True Ribbon=PremiumResin
Dest printer2 OtherOption=True
Default cltx0`
        } else if (
          file === "/etc/cups/ppd/printer1.ppd" ||
          file === "/usr/local/drivers/printer1.ppd"
        ) {
          return "something"
        } else if (file === "/usr/local/drivers/other.ppd") {
          return "something else"
        }
      },
    },
  }

  const asserter = new CupsPrintQueueExists(container)

  // Bad arguments
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )
  await expect(
    asserter.assert(createAssertNode(asserter, { queue: 1 }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { queue: "XYZ" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(createAssertNode(asserter, { queue: "valid" }))
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, { queue: "my-queue", deviceUri: true })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        shared: "",
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        errorPolicy: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        errorPolicy: "invalid",
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        location: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        info: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        accepting: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        ppdFile: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        ppdFile: "/not/there.ppd",
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        ppdOptions: 1,
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        ppdOptions: {}, // Must have ppdFile
      })
    )
  ).rejects.toThrow(ScriptError)
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "my-queue",
        deviceUri: "ipp://",
        ppdFile: "/usr/local/drivers/printer1.ppd",
        ppdOptions: {
          Option1: 1,
        },
      })
    )
  ).rejects.toThrow(ScriptError)

  // Print queue exists
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "printer1",
        deviceUri: "serial:/dev/usb/lp0",
        errorPolicy: "abort-job",
        shared: true,
        ppdFile: "/usr/local/drivers/printer1.ppd",
        ppdOptions: {
          PrintBothSides: "True",
          Ribbon: "PremiumResin",
        },
      })
    )
  ).resolves.toBe(true)

  // Print queue does not exist
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "printer3",
        deviceUri: "ipp://",
        shared: false,
        ppdFile: "/usr/local/drivers/printer1.ppd",
        ppdOptions: {
          Ribbon: "ForSure",
        },
      })
    )
  ).resolves.toBe(false)

  // Print queue is all different
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "printer1",
        deviceUri: "ipp://",
        errorPolicy: "retry-job",
        shared: false,
        location: "Somewhere",
        info: "HP Laserjet",
        accepting: false,
        ppdFile: "/usr/local/drivers/other.ppd",
        ppdOptions: {
          Ribbon: "CheapInk",
        },
      })
    )
  ).resolves.toBe(false)

  // lpoptions not accessible
  container.util.pathInfo = (path) => {
    if (path === "/usr/local/drivers/printer1.ppd") {
      return new PathInfo(
        {
          isFile: () => true,
          size: 100,
          uid: 1,
          gid: 1,
          mode: 0o777,
        },
        container
      )
    } else {
      return new PathInfo()
    }
  }
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "printer3",
        deviceUri: "ipp://",
        ppdFile: "/usr/local/drivers/printer1.ppd",
        ppdOptions: {
          Ribbon: "ForSure",
        },
      })
    )
  ).resolves.toBe(false)

  // Not running as root
  container.util.runningAsRoot = () => false
  await expect(
    asserter.assert(
      createAssertNode(asserter, {
        queue: "printer1",
        deviceUri: "serial:/dev/usb/lp0",
      })
    )
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: () => undefined,
    },
  }
  const asserter = new CupsPrintQueueExists(container)

  asserter.queueName = "my-printer"

  await expect(asserter.rectify()).resolves.toBeUndefined()

  asserter.updateFlags = 0xff
  asserter.deviceUri = "ipp://"
  asserter.errorPolicy = "abort-job"
  asserter.share = true
  asserter.accepting = true
  asserter.ppdFile = "/x/y"
  asserter.ppdOptions = { a: "b" }

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new CupsPrintQueueExists({})

  asserter.queueName = "my-printer"
  asserter.deviceUri = "ipp://somewhere.com:631/printer"
  asserter.errorPolicy = "retry-current-job"
  asserter.shared = false
  asserter.accepting = false

  expect(asserter.result()).toEqual({
    queue: asserter.queueName,
    deviceUri: asserter.deviceUri,
    errorPolicy: asserter.errorPolicy,
    shared: asserter.shared,
    accepting: asserter.accepting,
  })

  asserter.info = "x"
  asserter.location = "y"
  asserter.ppdFile = "/x/y"
  asserter.ppdOptions = { a: "b" }

  expect(asserter.result()).toEqual({
    queue: asserter.queueName,
    deviceUri: asserter.deviceUri,
    errorPolicy: asserter.errorPolicy,
    shared: asserter.shared,
    accepting: asserter.accepting,
    info: asserter.info,
    location: asserter.location,
    ppdFile: asserter.ppdFile,
    ppdOptions: asserter.ppdOptions,
  })
})
