import { OctopusTool } from "./OctopusTool"
import { createNode, createScriptNode } from "./testUtil"
import * as version from "./version"
import stream from "stream"

let container = null

beforeEach(() => {
  container = {
    toolName: "octopus",
    log: {
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
      output: jest.fn(),
    },
    util: {},
    fs: {},
  }
})

test("assertHasNode", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => {
    if (command === "node --version") {
      return {
        exitCode: 0,
        output: [OctopusTool.minNodeVersion],
      }
    } else {
      return {
        exitCode: 255,
        output: [""],
      }
    }
  }

  const tool = new OctopusTool(container)
  const ssh = {}

  await expect(tool.assertHasNode(ssh)).resolves.toBe(true)
})

test("assertCanSudoOnHost", async () => {
  let result = {
    exitCode: 0,
    output: ["/0"],
  }
  container.util.runRemoteCommand = async (ssh, command, options) => result

  const tool = new OctopusTool(container)
  const ssh = {
    config: [{ password: "", username: "test" }],
  }

  await expect(tool.assertCanSudoOnHost(ssh)).resolves.toBeUndefined()

  result = { exitCode: 0, output: ["/500"] }

  await expect(tool.assertCanSudoOnHost(ssh)).rejects.toThrow(Error)
})

test("rectifyHasNode", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => {
    if (command === 'bash -c "echo /$(date)"') {
      return {
        exitCode: 0,
        output: ["/" + new Date().toString()],
      }
    } else if (command === "node --version") {
      return {
        exitCode: 0,
        output: [OctopusTool.minNodeVersion],
      }
    } else if (command === "bash -c 'echo /$EUID'") {
      return {
        exitCode: 0,
        output: ["/0"],
      }
    } else {
      return {
        exitCode: 0,
        output: [""],
      }
    }
  }

  const tool = new OctopusTool(container)
  const ssh = {
    connect: jest.fn(async () => null),
    sftp: jest.fn(() => ({
      createWriteStream: async (path) =>
        new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        }),
    })),
    close: jest.fn(),
    config: [{ password: "", username: "test" }],
  }

  await expect(tool.rectifyHasNode(ssh)).resolves.toBeUndefined()
})

test("assertHasOctopus", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => ({
    exitCode: 0,
    output: [version.shortVersion],
  })

  const tool = new OctopusTool(container)
  const ssh = {}

  await expect(tool.assertHasOctopus(ssh)).resolves.toBe(true)
})

test("rectifyHasOctopus", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => {
    if (command === "npm install -g @johnls/octopus") {
      return {
        exitCode: 0,
        output: [],
      }
    } else if (command === "octopus --version") {
      return {
        exitCode: 0,
        output: [version.shortVersion],
      }
    } else {
      return {
        exitCode: 0,
        output: [""],
      }
    }
  }

  const tool = new OctopusTool(container)

  tool.assertCanSudoOnHost = jest.fn(async () => true)

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
      includes: [],
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
  container.asserters = {
    TestAssert: class TestAssert {
      constructor() {}
      assert() {}
      rectify() {}
      result() {}
    },
  }

  const tool = new OctopusTool(container)

  tool.compileScriptFile = jest.fn(async () => ({
    vars: {},
    options: {},
    assertions: [{ assert: "TestAssert", with: {} }],
    vmContext: {},
    expandStringNode: jest.fn(),
  }))

  await expect(tool.runScriptLocally("test.json5")).resolves.toBeUndefined()
})

test("runScriptRemotely", async () => {
  container.util.runRemoteCommand = async (ssh, command, options) => ({
    exitCode: 0,
    output: "",
  })
  container.createSSH = (sshConfig) => ({
    connect: jest.fn(async () => null),
    sftp: jest.fn(() => ({
      createWriteStream: async (path) =>
        new stream.Writable({
          write(chunk, encoding, callback) {
            callback()
          },
        }),
    })),
    close: jest.fn(),
    config: [{ password: "", username: "test" }],
  })

  const tool = new OctopusTool(container)

  tool.assertHasNode = jest.fn(() => true)
  tool.assertHasOctopus = jest.fn(() => true)
  tool.compileScriptFile = jest.fn(async () => ({
    vars: {},
    options: {},
    assertions: [{ assert: "TestAssert", with: {} }],
    vmContext: {},
    expandStringNode: jest.fn(),
  }))

  await expect(
    tool.runScriptRemotely("test.json5", {
      user: "test",
      password: "test",
      host: "somehost",
    })
  ).resolves.toBeUndefined()
})

test("run", async () => {
  const tool = new OctopusTool(container)

  await expect(tool.run(["--help"])).resolves.toBeUndefined()

  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringContaining("--help")
  )

  container.log.info.mockClear()

  await expect(tool.run(["--version"])).resolves.toBeUndefined()
  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringMatching(/\d\.\d\.\d/)
  )

  // TODO: More run tests
})
