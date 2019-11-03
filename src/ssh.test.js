test("run", async () => {
  const ssh = new SSH()

  class Socket extends EventEmitter {
    write() {}
    end() {}
  }

  let socket = new Socket()
  let ssh = {
    spawn: jest.fn(async () => socket),
  }

  process.nextTick(() => {
    socket.emit("close")
  })
  await expect(util.run(ssh, "ls")).resolves.toEqual({
    exitCode: 0,
    output: [],
  })

  process.nextTick(() => {
    socket.emit("close")
  })
  await expect(
    util.run(ssh, "ls", {
      cwd: "/a/b",
      sudo: true,
      debug: true,
      sudoPassword: "password",
    })
  ).resolves.toEqual({
    exitCode: 0,
    output: [],
  })

  process.nextTick(() => {
    socket.emit("error")
  })
  await expect(util.run(ssh, "xxx")).rejects.toThrow(Error)

  process.nextTick(() => {
    socket.emit("data", "/a/b/c\n1.2.3\n{a:1}\nerror:\nwarning:\n\n1")
    process.nextTick(() => {
      socket.emit("close")
    })
  })
  await expect(
    util.run(ssh, "nop", {
      password: "blah",
      log: jest.fn(),
      logError: jest.fn(),
    })
  ).rejects.toThrow(Error)
})
