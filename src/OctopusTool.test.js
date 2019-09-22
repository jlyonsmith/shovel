import { OctopusTool } from "./OctopusTool"
import * as testUtil from "./testUtil"
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
        settings: {},
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
    if (path.endsWith("b.json5")) {
      return `{
      settings: { blah: "x"},
      vars: { blah : "y"},
      scripts: [],
      assertions: [{ assert: "something" }],
    }`
    } else {
      return ""
    }
  }

  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")

  scriptNode.value.includes.value.push(
    testUtil.createNode(scriptNode.filename, "b.json5")
  )

  await expect(
    tool.mergeIncludeNodes(scriptNode, ".", scriptNode.value.includes)
  ).resolves.toBeUndefined()
})

test("flattenScript", async () => {
  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")

  await expect(tool.flattenScript(scriptNode)).resolves.toMatchObject({
    vars: {},
    settings: {},
    assertions: [],
  })
})

test("createRunContext", async () => {
  container.util.osInfo = jest.fn(() => ({
    platform: "blah",
    id: "blah",
    versionId: "1.2.3",
  }))
  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")

  scriptNode.vars = testUtil.createNode(scriptNode.filename, {
    s: "b",
    n: 1,
    x: null,
    b: true,
    a: [1, 2, 3],
    o: { s: "a", n: 2 },
    local: { s: "c" },
  })

  await expect(tool.createRunContext(scriptNode)).resolves.toMatchObject({
    runContext: {},
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

  tool.readScriptFile = jest.fn(async () => {})
  tool.flattenScript = jest.fn(async () => ({
    settings: {},
    vars: {},
    assertions: [
      {
        assert: "TestAssert",
        with: {},
        _assertNode: testUtil.createNode("test.json5", {
          assert: "TestAssert",
          with: {},
        }),
      },
    ],
  }))
  tool.createRunContext = jest.fn(async () => ({
    runContext: { vars: {} },
    expandStringNode: jest.fn((s) => s),
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
    settings: {},
    assertions: [{ assert: "TestAssert", with: {} }],
    runContext: { vars: {} },
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
