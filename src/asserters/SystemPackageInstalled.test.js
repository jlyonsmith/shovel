import { SystemPackageInstalled } from "./SystemPackageInstalled"
import { createAssertNode } from "../testUtil"
import { ScriptError } from "../ScriptError"

let container = null

test("assert", async () => {
  const container = {
    interpolator: (node) => node.value,
    childProcess: {},
    util: {
      runningAsRoot: jest.fn(() => true),
    },
  }
  const asserter = new SystemPackageInstalled(container)

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

  // Package present on Ubuntu
  container.childProcess.exec = jest.fn(async () => ({
    stdout: "",
    stderr: "",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "package" }))
  ).resolves.toBe(true)

  // Package present on CentOS
  container.util.osInfo = jest.fn(async () => ({
    platform: "linux",
    id: "centos",
  }))
  container.childProcess.exec = jest.fn(async () => ({
    stdout: "",
    stderr: "",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "package" }))
  ).resolves.toBe(true)

  // Package not present and running as root
  container.childProcess.exec = jest.fn(async () => {
    throw new Error()
  })
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "notthere" }))
  ).resolves.toBe(false)

  // Package not present and not running as root
  container.util.runningAsRoot = jest.fn(() => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { package: "notthere" }))
  ).rejects.toThrow(ScriptError)
})

test("rectify", async () => {
  const container = {
    childProcess: {
      exec: jest.fn(async (command) => ({
        stdout: "",
        stderr: "",
      })),
    },
  }

  const asserter = new SystemPackageInstalled(container)

  asserter.installCommand = ""

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new SystemPackageInstalled({})

  asserter.expandedPackageName = "somepackage"

  expect(asserter.result()).toEqual({ package: asserter.expandedPackageName })
})
