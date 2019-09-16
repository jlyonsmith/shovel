import { PackageRemoved } from "./PackageRemoved"
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
  const asserter = new PackageRemoved(container)

  // Not supported OS
  container.util.getOSInfo = jest.fn(async () => ({ platform: "windows" }))
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "test" }))
  ).rejects.toThrow(ScriptError)

  // Missing name
  container.util.getOSInfo = jest.fn(async () => ({
    platform: "linux",
    id: "ubuntu",
  }))
  await expect(asserter.assert(createAssertNode(asserter, {}))).rejects.toThrow(
    ScriptError
  )

  // Bad name
  await expect(
    asserter.assert(createAssertNode(asserter, { name: 1 }))
  ).rejects.toThrow(ScriptError)

  // Package not present on Ubuntu
  container.childProcess.exec = jest.fn(async (command) => {
    throw new Error()
  })
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "there" }))
  ).resolves.toBe(true)

  // Package not present on CentOS
  container.util.getOSInfo = jest.fn(async () => ({
    platform: "linux",
    id: "centos",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "there" }))
  ).resolves.toBe(true)

  // Package present and running as root
  container.childProcess.exec = jest.fn(async (command) => ({
    stdout: "",
    stderr: "",
  }))
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "notthere" }))
  ).resolves.toBe(false)

  // Package present and not running as root
  container.util.runningAsRoot = jest.fn(() => false)
  await expect(
    asserter.assert(createAssertNode(asserter, { name: "there" }))
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
  const asserter = new PackageRemoved(container)

  asserter.expandedName = "somepackage"

  await expect(asserter.rectify()).resolves.toBeUndefined()
})

test("result", () => {
  const asserter = new PackageRemoved({})

  asserter.expandedName = "somepackage"

  expect(asserter.result()).toEqual({ name: asserter.expandedName })
})
