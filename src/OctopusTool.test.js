import { OctopusTool } from "./OctopusTool"
import { createNode, createScriptNode } from "./testUtil"
import * as version from "./version"

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

test("assertHasOctopus", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => ({
    exitCode: 0,
    output: version.shortVersion,
  })

  const tool = new OctopusTool(container)
  const ssh = {}

  await expect(tool.assertHasOctopus(ssh)).resolves.toBe(true)
})

test("rectifyHasOctopus", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => {
    if (command === "octopus --version") {
      return {
        exitCode: 0,
        output: version.shortVersion,
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

  await expect(tool.rectifyHasOctopus(ssh)).resolves.toBeUndefined()
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

test("mergeIncludeNodes", async () => {
  container.fs.readFile = (path) => {
    return `{
      options: { blah: "x"},
      vars: { blah : "y"},
      scripts: [],
      assertions: [{ assert: "something" }],
    }`
  }

  const tool = new OctopusTool(container)
  const scriptNode = createScriptNode("a.json5")

  scriptNode.value.includes.value.push(
    createNode(scriptNode.filename, "b.json5")
  )

  await expect(
    tool.mergeIncludeNodes(scriptNode, ".", scriptNode.value.includes)
  ).resolves.toBeUndefined()
})

test("compileScriptFile", async () => {
  container.fs.readFile = (path) => {
    return `{
      options: { blah: "x"},
      vars: { blah : "y"},
      scripts: [],
      assertions: [{ assert: "something", with: {} }],
    }`
  }

  const tool = new OctopusTool(container)

  await expect(tool.compileScriptFile("test.json5")).resolves.toMatchObject({
    vars: { blah: "y" },
    options: { blah: "x" },
  })
})

test("runScriptLocally", async () => {
  // TODO: runScriptLocally test
})

test("runScriptRemotely", async () => {
  // TODO: runScriptRemotely test
})

test("run", async () => {
  const tool = new OctopusTool(container)

  await expect(tool.run(["--help"])).resolves.toBe(0)

  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringContaining("--help")
  )

  container.log.info.mockClear()

  await expect(tool.run(["--version"])).resolves.toBe(0)
  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringMatching(/\d\.\d\.\d/)
  )

  // TODO: More run tests
})
