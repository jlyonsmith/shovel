import { OctopusTool } from "./OctopusTool"
import * as testUtil from "./testUtil"
import * as version from "./version"
import stream from "stream"
import { ScriptError } from "./ScriptError"

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
  }
})

test("constructor", () => {
  const tool = new OctopusTool()

  expect(tool).not.toBe(null)
  expect(tool.createSsh()).not.toBe(null)
  expect(tool.createSftp()).not.toBe(null)
})

test("assertHasNode", async () => {
  const ssh = {
    run: async (command, options) => {
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
    },
  }
  const tool = new OctopusTool(container)

  await expect(tool.assertHasNode(ssh)).resolves.toBe(true)
})

test("rectifyHasNode", async () => {
  const tool = new OctopusTool(container)

  // Success
  const ssh = {
    run: async (command, options) => {
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
    },
  }
  const sftp = { putContent: async () => undefined }

  await expect(tool.rectifyHasNode(ssh, sftp)).resolves.toBeUndefined()

  // Test debug stuff now
  tool.debug = true
  await expect(tool.rectifyHasNode(ssh, sftp)).resolves.toBeUndefined()
  tool.debug = false

  // Unable to get date
  ssh.run = async (command, options) => ({
    exitCode: 0,
    output: [""],
  })
  await expect(tool.rectifyHasNode(ssh, sftp)).rejects.toThrow(Error)

  // Bad date
  ssh.run = async (command, options) => ({
    exitCode: 0,
    output: ["/Wed Oct 1 12:00:00 UTC 2010"],
  })
  await expect(tool.rectifyHasNode(ssh)).rejects.toThrow(Error)

  // Bad install
  ssh.run = async (command, options) => {
    if (command === 'bash -c "echo /$(date)"') {
      return {
        exitCode: 0,
        output: ["/" + new Date().toString()],
      }
    } else if (command === "mktemp") {
      return {
        exitCode: 0,
        output: [""],
      }
    } else {
      return {
        exitCode: 255,
        output: [""],
      }
    }
  }
  await expect(tool.rectifyHasNode(ssh, sftp)).rejects.toThrow(Error)

  // Bad install
  ssh.run = async (command, options) => {
    if (command === 'bash -c "echo /$(date)"') {
      return {
        exitCode: 0,
        output: ["/" + new Date().toString()],
      }
    } else if (command === "mktemp") {
      return {
        exitCode: 0,
        output: [""],
      }
    } else {
      return {
        exitCode: 255,
        output: [""],
      }
    }
  }
  await expect(tool.rectifyHasNode(ssh, sftp)).rejects.toThrow(Error)

  // Bad version
  ssh.run = async (command, options) => {
    if (command === 'bash -c "echo /$(date)"') {
      return {
        exitCode: 0,
        output: ["/" + new Date().toString()],
      }
    } else if (command === "node --version") {
      return {
        exitCode: 255,
        output: ["/255"],
      }
    } else {
      return {
        exitCode: 0,
        output: [""],
      }
    }
  }
  await expect(tool.rectifyHasNode(ssh, sftp)).rejects.toThrow(Error)
})

test("assertHasOctopus", async () => {
  const ssh = {
    run: async (command, options) => ({
      exitCode: 0,
      output: [version.shortVersion],
    }),
  }
  const tool = new OctopusTool(container)

  await expect(tool.assertHasOctopus(ssh)).resolves.toBe(true)
})

test("rectifyHasOctopus", async () => {
  const ssh = {
    run: async (command, options) => {
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
    },
  }
  const tool = new OctopusTool(container)

  // Success
  await expect(tool.rectifyHasOctopus(ssh)).resolves.toBeUndefined()

  // Failed after install
  ssh.run = async (command, options) => ({
    exitCode: 255,
    output: [],
  })
  await expect(tool.rectifyHasOctopus(ssh)).rejects.toThrow(Error)

  // Failed install
  ssh.run = async (command, options) => {
    return {
      exitCode: 0,
      output: [""],
    }
  }
  await expect(tool.rectifyHasOctopus(ssh)).rejects.toThrow(Error)
})

test("readScriptFile", async () => {
  Object.assign(container, { fs: { readFile: (path) => "[]" } })

  const tool = new OctopusTool(container)

  // Bad empty script
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Empty script
  container.fs.readFile = (path) => "{}"
  await expect(tool.readScriptFile("test.json5")).resolves.not.toBeNull()

  // Clean script
  container.fs.readFile = (path) =>
    `{
      settings: {},
      includes: ["something.json5"],
      vars: { a: 1, b: null, c: [1,2,3], d: { x: "x" }},
      assertions: [{assert: "Thing", with: {}}],
    }`
  await expect(tool.readScriptFile("test.json5")).resolves.not.toBeNull()

  // Bad settings
  container.fs.readFile = (path) =>
    `{
      settings: [],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad description
  container.fs.readFile = (path) =>
    `{
      settings: {description: 1},
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad includes
  container.fs.readFile = (path) =>
    `{
      includes: {},
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad include
  container.fs.readFile = (path) =>
    `{
      includes: [1],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad vars
  container.fs.readFile = (path) =>
    `{
      vars: [],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad assertions
  container.fs.readFile = (path) =>
    `{
      assertions: {},
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad assertion
  container.fs.readFile = (path) =>
    `{
      assertions: [1],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Missing assertion name
  container.fs.readFile = (path) =>
    `{
      assertions: [{}],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad assertion name
  container.fs.readFile = (path) =>
    `{
      assertions: [{ assert: 1 }],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad assertion description
  container.fs.readFile = (path) =>
    `{
      assertions: [{ assert: "Thing", description: 1 }],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)

  // Bad assertion with
  container.fs.readFile = (path) =>
    `{
      assertions: [{ assert: "Thing", with: 1 }],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)
  // Bad assertion when
  container.fs.readFile = (path) =>
    `{
      assertions: [{ assert: "Thing", when: 1 }],
    }`
  await expect(tool.readScriptFile("test.json5")).rejects.toThrow(ScriptError)
})

test("createRunContext", async () => {
  Object.assign(container, {
    util: {
      osInfo: async () => ({
        platform: "blah",
        id: "blah",
        versionId: "1.2.3",
      }),
      userInfo: () => ({}),
    },
    fs: {
      readFileSync: () => "foobar",
    },
  })

  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")

  // No vars
  scriptNode.value.vars = undefined

  let result = await tool.createRunContext(scriptNode)

  expect(result).toMatchObject({
    runContext: {},
  })

  // With vars
  scriptNode.value.vars = testUtil.createNode(scriptNode.filename, {
    s: "b",
    n: 1,
    x: null,
    b: true,
    a: [1, 2, 3],
    o: { s: "a", n: 2 },
    local: { s: "c" },
  })
  result = await tool.createRunContext(scriptNode)
  expect(result).toMatchObject({
    runContext: {},
  })
  expect(
    result.expandStringNode(testUtil.createNode(scriptNode.filename, "test"))
  ).toBe("test")
  expect(() =>
    result.expandStringNode(testUtil.createNode(scriptNode.filename, 1))
  ).toThrow(Error)
  expect(() =>
    result.expandStringNode(testUtil.createNode(scriptNode.filename, "{x()}"))
  ).toThrow(ScriptError)

  // Context functions
  expect(
    result.expandStringNode(
      testUtil.createNode(scriptNode.filename, "{fs.readFile('blah')}")
    )
  ).toBe("foobar")
  expect(
    result.expandStringNode(
      testUtil.createNode(scriptNode.filename, "{path.join('foo', 'bar')}")
    )
  ).toBe("foo/bar")
  expect(
    result.expandStringNode(
      testUtil.createNode(scriptNode.filename, "{path.dirname('foo/bar')}")
    )
  ).toBe("foo")
})

test("mergeIncludeNodes", async () => {
  Object.assign(container, {
    fs: {
      readFile: async (path) => {
        if (path.endsWith("b.json5")) {
          return `{
            settings: { blah: "x"},
            vars: { blah : "y"},
            scripts: [],
            assertions: [{ assert: "something" }],
          }`
        } else if (path.endsWith("c.json5")) {
          return "{}"
        }
      },
    },
  })

  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")
  const includesNode = scriptNode.value.includes

  includesNode.value.push(testUtil.createNode(scriptNode.filename, "b.json5"))
  includesNode.value.push(testUtil.createNode(scriptNode.filename, "c.json5"))

  await expect(
    tool.mergeIncludeNodes(scriptNode, ".", includesNode)
  ).resolves.toBeUndefined()
})

test("flattenScript", async () => {
  const tool = new OctopusTool(container)
  const scriptNode = testUtil.createScriptNode("a.json5")
  const assertionsNode = scriptNode.value.assertions

  assertionsNode.value.push(
    testUtil.createNode(scriptNode.filename, { assert: "something" })
  )

  await expect(tool.flattenScript(scriptNode)).resolves.toMatchObject({
    assertions: [
      {
        _assertNode: {
          column: 0,
          filename: "a.json5",
          line: 0,
          type: "object",
          value: {
            assert: {
              column: 0,
              filename: "a.json5",
              line: 0,
              type: "string",
              value: "something",
            },
          },
        },
        assert: "something",
      },
    ],
  })
})

test("runScriptLocally", async () => {
  Object.assign(container, {
    debug: true,
    asserters: {
      TestAssert: class TestAssert {
        constructor() {}
        async assert(node) {
          const withNode = node.value.with

          return withNode && withNode.value.assert
        }
        async rectify() {}
        result() {}
      },
    },
    util: { runningAsRoot: () => true },
    process: {
      seteuid: () => undefined,
      setegid: () => undefined,
      env: {
        SUDO_UID: "1",
        SUDO_GID: "1",
      },
    },
    ora: () => ({
      start: () => undefined,
      stop: () => undefined,
    }),
  })

  const tool = new OctopusTool(container)
  const assert1 = {
    assert: "TestAssert",
    description: "hmmm",
    with: {},
    become: "root",
    when: "",
  }
  const assert2 = {
    assert: "TestAssert",
    with: {},
    when: false,
  }
  const assert3 = {
    assert: "TestAssert",
    with: {
      assert: true,
    },
  }
  const assert4 = {
    assert: "TestAssert",
    with: {},
  }

  tool.readScriptFile = jest.fn(async () => {})
  tool.flattenScript = jest.fn(async () => ({
    settings: {
      description: "Blah",
    },
    vars: {},
    assertions: [
      Object.assign({}, assert1, {
        _assertNode: testUtil.createNode("test.json5", assert1),
      }),
      Object.assign({}, assert2, {
        _assertNode: testUtil.createNode("test.json5", assert2),
      }),
      Object.assign({}, assert3, {
        _assertNode: testUtil.createNode("test.json5", assert3),
      }),
    ],
  }))
  tool.createRunContext = jest.fn(async () => ({
    runContext: { vars: {} },
    expandStringNode: jest.fn((s) => s),
  }))

  // Has becomes
  await expect(
    tool.runScriptLocally("test.json5", {
      spinner: true,
    })
  ).resolves.toBeUndefined()

  // Has becomes and not running as root
  container.util.runningAsRoot = () => false
  await expect(tool.runScriptLocally("test.json5")).rejects.toThrow(
    "not running as root"
  )

  // No becomes
  tool.debug = false
  tool.flattenScript = jest.fn(async () => ({
    settings: {},
    vars: {},
    assertions: [
      Object.assign({}, assert4, {
        _assertNode: testUtil.createNode("test.json5", assert4),
      }),
    ],
  }))
  await expect(tool.runScriptLocally("test.json5")).resolves.toBeUndefined()
})

test("runScriptRemotely", async () => {
  Object.assign(container, {
    debug: true,
    createSsh: () => ({
      connect: async () => undefined,
      run: async (command, options) => ({
        exitCode: 0,
        output: "/tmp/1234",
      }),
      close: () => undefined,
    }),
    createSftp: () => ({
      connect: async () => undefined,
      putContent: async () => undefined,
      close: () => undefined,
    }),
  })
  const tool = new OctopusTool(container)

  tool.assertHasNode = () => true
  tool.assertHasOctopus = () => true
  tool.readScriptFile = async () => ({})
  tool.getSshOptions = async () => [{}]
  tool.flattenScript = async () => ({ assertions: [] })
  tool.createRunContext = async () => ({
    runContext: { vars: {} },
    expandStringNode: (s) => s,
  })

  // Happy path
  await expect(
    tool.runScriptRemotely("test.json5", {
      user: "test",
      password: "test",
      host: "somehost",
    })
  ).resolves.toBeUndefined()

  // Without Node or Octopus
  tool.debug = false
  tool.assertHasNode = () => false
  tool.assertHasOctopus = () => false
  tool.rectifyHasNode = async () => undefined
  tool.rectifyHasOctopus = async () => undefined
  tool.flattenScript = async () => ({
    assertions: [{ assert: "Thing", become: true, _assertNode: {} }],
  })
  await expect(
    tool.runScriptRemotely("test.json5", {
      user: "test",
      password: "test",
      host: "somehost",
    })
  ).resolves.toBeUndefined()

  // SSH creation throws
  tool.createSsh = () => ({
    connect: async () => {
      throw new Error("bad ssh connect")
    },
    close: () => undefined,
  })
  await expect(
    tool.runScriptRemotely("test.json5", {
      user: "test",
      password: "test",
      host: "somehost",
    })
  ).rejects.toThrow("bad ssh connect")
})

test("run", async () => {
  container.util = {
    parsePort: () => 0,
  }
  container.fs = {
    readFile: async () =>
      '[{ host: "foo", port: 22, user: "fred", identity: "bar" }]',
  }

  const tool = new OctopusTool(container)

  tool.runScriptLocally = async () => undefined
  tool.runScriptRemotely = async () => undefined

  // Help
  await expect(tool.run(["--help"])).resolves.toBeUndefined()

  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringContaining("--help")
  )

  container.log.info.mockClear()

  // Version
  await expect(tool.run(["--version"])).resolves.toBeUndefined()
  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringMatching(/\d\.\d\.\d/)
  )

  // Running script directly
  await expect(tool.run(["somescript.json5"])).resolves.toBeUndefined()

  // Too many scripts
  await expect(
    tool.run(["somescript.json5", "otherscript.json5"])
  ).rejects.toThrow(Error)
  expect(container.log.info.mock.calls[0][0]).toEqual(
    expect.stringMatching(/\d\.\d\.\d/)
  )

  // Missing host/hosts-file
  await expect(
    tool.run(["--identity", "id_rsa", "otherscript.json5"])
  ).rejects.toThrow(Error)

  // Running script
  await expect(
    tool.run(["somescript.json5", "--host", "somehost"])
  ).resolves.toBeUndefined()

  // Hosts file
  await tool.run(["somescript.json5", "--host-file", "hostfile.json5"])
  // await expect(
  //   tool.run(["somescript.json5", "--host-file", "hostfile.json5"])
  // ).resolves.toBeUndefined()

  // Running remote script that fails
  tool.runScriptRemotely = async () => {
    throw new Error()
  }
  await expect(
    tool.run(["somescript.json5", "--debug", "--host", "somehost"])
  ).rejects.toThrow("hosts")

  // Running remote script that fails (no debug)
  await expect(
    tool.run(["somescript.json5", "--host", "somehost"])
  ).rejects.toThrow(Error)
})
