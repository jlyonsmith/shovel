import { SystemPackageRemoved } from "./SystemPackageRemoved"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {},
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
  const asserter = new SystemPackageRemoved(container)

  // Not supported OS
  container.util.osInfo = jest.fn(async () => ({ platform: "windows" }))
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "test" }))
  ).rejects.toThrow(ScriptError)

  // Missing package
  container.util.osInfo = jest.fn(async () => ({
    platform: "linux",
    id: "ubuntu",
  }))
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )

  // Bad package
  await expect(
    asserter.assert(createAssertNode(asserter, { package: 1 }))
  ).rejects.toThrow(ScriptError)

  // Package not present on Ubuntu
  container.childProcess.exec = jest.fn(async (command) => {
    throw new Error()
  })
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "there" }))
  ).resolves.toBe(true)

  // Package not present on CentOS
  container.util.osInfo = jest.fn(async () => ({
    platform: "linux",
    id: "centos",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "there" }))
  ).resolves.toBe(true)

  // Package present and running as root
  container.childProcess.exec = jest.fn(async (command) => ({
    stdout: "",
    stderr: "",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "notthere" }))
  ).resolves.toBe(false)

  // Package present and not running as root
  container.util.runningAsRoot = jest.fn(() => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "there" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    expandStringNode: (node) => node.value,
    childProcess: {
      exec: jest.fn(async (command) => ({
        stdout: "",
        stderr: "",
      })),
    },
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
  const asserter = new SystemPackageRemoved(container)

  asserter.expandedPackageName = "somepackage"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new SystemPackageRemoved({})

  asserter.expandedPackageName = "somepackage"

  expect(asserter.result()).toEqual({ package: asserter.expandedPackageName })
})
