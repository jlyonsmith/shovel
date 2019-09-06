import * as util from "./util"

let container = null

beforeEach(() => {
  container = {
    fs: {
      lstat: jest.fn((path) => {
        if (path === "somedir") {
          return {
            isDirectory: () => true,
          }
        } else {
          return {
            isDirectory: () => false,
          }
        }
      }),
      readFile: jest.fn((path, options) => {
        if (path === "/etc/passwd") {
          return `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
someuser:x:1000:1000:Some User:/home/someuser:/bin/bash
sshd:x:110:65534::/run/sshd:/usr/sbin/nologin
ntp:x:111:113::/nonexistent:/usr/sbin/nologin`
        } else if (path === "/etc/group") {
          return `root:x:0:
daemon:x:1:
bin:x:2:
sys:x:3:
adm:x:4:syslog,someuser
tty:x:5:
disk:x:6:
lp:x:7:
mail:x:8:
news:x:9:
uucp:x:10:
man:x:12:
cdrom:x:24:someuser
floppy:x:25:
tape:x:26:
sudo:x:27:someuser`
        }
      }),
    },
    childProcess: {},
    os: {
      userInfo: jest.fn(() => ({
        uid: container._runningAsUid,
      })),
    },
    _runningAsUid: 0,
  }
})

test("runnAsRoot when root", async () => {
  expect(util.runningAsRoot(container.os)).toBe(true)
})

test("dirExists with directory existing", async () => {
  await expect(util.dirExists(container.fs, "somedir")).resolves.toBe(true)
})

test("dirExists with directory not existing", async () => {
  await expect(util.dirExists(container.fs, "notthere")).resolves.toBe(false)
})

test("getUsers when root", async () => {
  await expect(util.getUsers(container.fs)).resolves.toContainEqual({
    name: "mail",
    password: "x",
    uid: 8,
    gid: 8,
    name: "mail",
    homeDir: "/var/mail",
    shell: "/usr/sbin/nologin",
    comment: "mail",
  })
})

test("getGroups when root", async () => {
  await expect(util.getGroups(container.fs)).resolves.toContainEqual({
    name: "adm",
    password: "x",
    gid: 4,
    users: ["syslog", "someuser"],
  })
})
