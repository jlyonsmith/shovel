import { OctopusTool } from "./OctopusTool"
import { Script } from "vm"

let container = null

beforeEach(() => {
  container = {
    toolName: "octopus",
    log: {
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
    util: {},
    fs: {},
  }
})

const getOutput = (fn) => {
  const calls = fn.mock.calls

  return calls.length > 0 && calls[0].length > 0 ? calls[0][0] : ""
}

test("help", async () => {
  const tool = new OctopusTool(container)
  const exitCode = await tool.run(["--help"])

  expect(exitCode).toBe(0)
  expect(getOutput(container.log.info)).toEqual(
    expect.stringContaining("--help")
  )
})

test("version", async () => {
  const tool = new OctopusTool(container)
  const exitCode = await tool.run(["--version"])

  expect(exitCode).toBe(0)
  expect(getOutput(container.log.info)).toEqual(
    expect.stringMatching(/\d\.\d\.\d/)
  )
})

test("assertHasNode", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => ({
    exitCode: 0,
    output: OctopusTool.minNodeVersion,
  })

  const tool = new OctopusTool(container)
  const ssh = {}

  await expect(tool.assertHasNode(ssh)).resolves.toBe(true)
})

test("assertCanSudoOnHost", async () => {
  const result = {
    exitCode: 0,
    output: "/0",
  }
  container.util.runRemoteCommand = async (ssh, command, options) => result

  const tool = new OctopusTool(container)
  const ssh = {
    config: [{ password: "", username: "test" }],
  }

  await expect(tool.assertCanSudoOnHost(ssh)).resolves.toBeUndefined()

  result.output = "/500"

  //await expect(tool.assertCanSudoOnHost(ssh)).rejects.toThrow(Error)
})

test("rectifyHasNode", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => {
    if (command === 'bash -c "echo /$(date)"') {
      return {
        exitCode: 0,
        output: "/" + new Date().toString(),
      }
    } else if (command === "node --version") {
      return {
        exitCode: 0,
        output: OctopusTool.minNodeVersion,
      }
    } else if (command === "bash -c 'echo /$EUID'") {
      return {
        exitCode: 0,
        output: "/0",
      }
    } else {
      return {
        exitCode: 0,
        output: "",
      }
    }
  }

  const tool = new OctopusTool(container)
  const ssh = {
    config: [{ password: "", username: "test" }],
  }

  await expect(tool.rectifyHasNode(ssh)).resolves.toBeUndefined()
})

test("readScriptFile", async () => {
  container.fs.readFile = (path) => {
    if (path === "test1.json5") {
      return `{
        options: {},
        vars: {},
        scripts: [],
        assertions: [],
      }`
    }
  }

  const tool = new OctopusTool(container)

  await expect(tool.readScriptFile("test1.json5")).not.toBeNull()
})
// TODO: Add a test for assertHasOctopus
// TODO: Add a test for rectifyHasOctopus
// TODO: Add a test for processScriptFile
// TODO: Add a test for runScript
// TODO: Add a test for runScriptOnHost
// TODO: Add a test for run with local only script
// TODO: Add a test for run with host and script
// TODO: Add a test for run with multiple hosts and script
