import { SSH } from "./ssh"
import EventEmitter from "events"

test("constructor", async () => {
  const ssh = new SSH()

  expect(ssh).not.toBeNull()
})

test("parseLines", async () => {
  const ssh = new SSH()
  const result = SSH.parseLines(
    "error:\nfred@localhost's password:\nfred@localhost: Permission denied\n[sudo] password for\nabc\n/x/y/z\nv1.2.3\n{}\n> start\n0\nPS1>\n"
  )

  expect(result).toEqual({
    outputLines: ["/x/y/z", "v1.2.3"],
    errorLines: ["error:"],
    jsonLines: ["{}"],
    startLine: "> start",
    exitCode: 0,
    ready: false,
    permissionDenied: true,
    loginPasswordPrompt: "fred@localhost's password:",
    sudoPasswordPrompt: "[sudo] password for",
  })
})

test("connect", async () => {
  class PsuedoTerm extends EventEmitter {
    write() {}
    destroy() {
      this.emit("exit", null)
    }
    onData(cb) {
      this.on("data", cb)
      return { dispose: () => undefined }
    }
    onExit(cb) {
      this.on("exit", cb)
      return { dispose: () => undefined }
    }
  }

  const pty = new PsuedoTerm()
  const container = {
    process: { stdin: {}, stdout: {}, exit: () => null },
    console: { log: () => null },
    nodePty: {
      spawn: () => pty,
      destroy: () => {
        undefined
      },
    },
    readlinePassword: {
      createInstance: () => {
        const Instance = class extends EventEmitter {
          async passwordAsync() {
            return "abc"
          }
          close() {}
        }

        return new Instance()
      },
    },
  }
  let ssh = new SSH(container)

  // Success with password
  setImmediate(() => {
    pty.emit("data", "")
    pty.emit("data", "x@y's password:")
    setImmediate(() => {
      pty.emit("data", "")
      pty.emit("data", "x@y's password:") // Twice to test caching
      setImmediate(() => {
        pty.emit("data", "Verification code:")
        pty.emit("data", "PS1>")
      })
    })
  })
  await expect(ssh.connect({ host: "host" })).resolves.toBeUndefined()

  // Permission denied
  ssh.close()
  setImmediate(() => {
    pty.emit("data", "x@y: Permission denied")
  })
  await expect(ssh.connect({ host: "host" })).rejects.toThrow(
    "Unable to connect"
  )

  // All options
  ssh.close()
  await expect(
    ssh.connect({
      host: "host",
      port: 22,
      identity: "~/.ssh/id_rsa",
      user: "fred",
    })
  )

  // Already connected
  await expect(ssh.connect({ host: "xyz" })).rejects.toThrow(
    "Already connected"
  )

  // No host
  ssh.close()
  await expect(ssh.connect()).rejects.toThrow("Host must")

  // Bad ssh spawn
  container.nodePty.spawn = () => {
    throw new Error()
  }
  await expect(ssh.connect({ host: "xyz" })).rejects.toThrow(Error)
})

test("showPrompt", async () => {
  const rlp = new EventEmitter()
  const ssh = new SSH({
    process: {
      stdin: {},
      stdout: {},
      exit: () => null,
    },
    console: { log: () => null },
    nodePty: {},
    readlinePassword: { createInstance: () => rlp },
  })

  // Success
  rlp.passwordAsync = async () => "abc"
  rlp.close = () => undefined
  await expect(ssh.showPrompt("xyz")).resolves.toBe("abc")

  // Ctrl+C
  rlp.passwordAsync = () =>
    new Promise((resolve, reject) => {
      setImmediate(() => {
        rlp.emit("SIGINT")
        resolve()
      })
    })
  await expect(ssh.showPrompt("xyz")).resolves.toBeUndefined()
})

test("run", async () => {
  class PsuedoTerm extends EventEmitter {
    write() {}
    onData(cb) {
      this.on("data", cb)
      return { dispose: () => undefined }
    }
    destroy() {}
  }

  const pty = new PsuedoTerm()
  const container = {
    process: { stdin: {}, stdout: {}, exit: () => null },
    console: { log: () => null },
    readlinePassword: {
      createInstance: () => {
        const Instance = class extends EventEmitter {
          async passwordAsync() {
            return "abc"
          }
          close() {}
        }

        return new Instance()
      },
    },
  }
  let ssh = new SSH(container)

  // No terminal
  await expect(ssh.run("bash")).rejects.toThrow("No terminal")

  // Success
  ssh.pty = pty
  setImmediate(() => {
    pty.emit("data", "> start\nerror: blah\n{x:1}\n")
    pty.emit("data", "[sudo] password for x")
    setImmediate(() => {
      pty.emit("data", "/x\n0\nPS1>")
    })
  })
  await expect(
    ssh.run("something", {
      logError: () => undefined,
      logOutput: () => undefined,
      logStart: () => undefined,
      cwd: "/x/y",
      sudo: true,
      timeout: 10000,
    })
  ).resolves.toEqual({
    exitCode: 0,
    output: ["/x"],
  })

  // Bad exit code, no timeout
  setImmediate(() => {
    pty.emit("data", "1\nPS1>")
  })
  await expect(ssh.run("something")).rejects.toThrow(Error)
})

test("close", () => {
  const ssh = new SSH()

  ssh.pty = { destroy: () => undefined }

  // No terminal connected
  ssh.pty = null
  expect(() => ssh.close()).toThrow("No terminal")
})
