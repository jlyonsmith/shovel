import { jest } from "@jest/globals"
import { SFTP } from "./sftp.js"
import EventEmitter from "events"

test("constructor", async () => {
  const sftp = new SFTP()
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
  let sftp = new SFTP(container)

  // Success with password
  setImmediate(() => {
    pty.emit("data", "warning: x\n\n")
    pty.emit("data", "x@y's password:")
    setImmediate(() => {
      pty.emit("data", "sftp>")
    })
  })
  await expect(sftp.connect({ host: "host" })).resolves.toBeUndefined()

  // Permission denied
  sftp.close()
  setImmediate(() => {
    pty.emit("data", "x@y: Permission denied")
  })
  await expect(sftp.connect({ host: "host" })).rejects.toThrow(
    "Unable to connect"
  )

  // All options
  sftp.close()
  await expect(
    sftp.connect({
      host: "host",
      port: 22,
      identity: "~/.ssh/id_rsa",
      user: "fred",
    })
  )

  // Already connected
  await expect(sftp.connect({ host: "xyz" })).rejects.toThrow(
    "Already connected"
  )

  // No host
  sftp.close()
  await expect(sftp.connect()).rejects.toThrow("Host must")

  // Bad ssh spawn
  container.nodePty.spawn = () => {
    throw new Error()
  }
  await expect(sftp.connect({ host: "xyz" })).rejects.toThrow(Error)
})

test("parseLines", async () => {
  const ssh = new SFTP()
  const result = SFTP.parseLines(
    "\nerror:\nfred@localhost's password:\nfred@localhost: Permission denied\nsftp>"
  )

  expect(result).toEqual({
    errorLines: ["error:"],
    ready: true,
    permissionDenied: true,
    loginPasswordPrompt: "fred@localhost's password:",
  })
})

test("showPrompt", async () => {
  const rlp = new EventEmitter()
  const sftp = new SFTP({
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
  await expect(sftp.showPrompt("xyz")).resolves.toBe("abc")

  // Ctrl+C
  rlp.passwordAsync = () =>
    new Promise((resolve, reject) => {
      setImmediate(() => {
        rlp.emit("SIGINT")
        resolve()
      })
    })
  await expect(sftp.showPrompt("xyz")).resolves.toBeUndefined()
})

test("putContent", async () => {
  class PsuedoTerm extends EventEmitter {
    write() {}
    destroy() {
      this.emit("exit", null)
    }
    onData(cb) {
      this.on("data", cb)
      return { dispose: () => undefined }
    }
  }

  const pty = new PsuedoTerm()
  const container = {
    process: { stdin: {}, stdout: {}, exit: () => null },
    console: { log: () => null },
    fs: {
      writeFile: async () => undefined,
    },
  }
  let sftp = new SFTP(container)

  // No terminal
  await expect(sftp.putContent()).rejects.toThrow("No terminal")

  // Success
  sftp.pty = pty
  setImmediate(() => {
    pty.emit("data", "some output\n")
    pty.emit("data", "sftp>")
  })
  await expect(
    sftp.putContent("/x/y", "content", {
      logError: () => undefined,
      timeout: 10000,
    })
  ).resolves.toBeUndefined()

  // No timeout
  setImmediate(() => {
    pty.emit("data", "sftp>")
  })
  await expect(sftp.putContent("/x/y", "something")).resolves.toBeUndefined()

  // Failed upload
  setImmediate(() => {
    pty.emit("data", "error: xyz\nsftp>")
  })
  await expect(sftp.putContent("/x/y", "something")).rejects.toThrow(Error)
})

test("close", () => {
  const sftp = new SFTP()

  sftp.pty = { destroy: () => undefined }

  // No terminal connected
  sftp.pty = null
  expect(() => sftp.close()).toThrow("No terminal")
})
