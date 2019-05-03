const fs = require("fs-extra")
const childProcess = require("child_process")
const os = require("os")
/*
Checks and ensures that a user exists.

Example:

{
  assert: "userExists",
  with: {
    name: "userName"
  }
}
*/

export class UserExists {
  async assert(args) {
    try {
      // TODO : check if user exists using something from https://stackoverflow.com/questions/14810684/check-whether-a-user-exists
      const platform = await os.platform()
      switch (platform) {
        // MAC OS
        case "darwin":
          console.log("MAC BOX DETECTED")
          await childProcess.exec(
            `dscl . read /Users/${args.name}`,
            async (err, stdout, stderr) => {
              console.log("EXEC RUN")
              if (err) {
                console.log("ERROR CHECKING USER", err)
                return false
              }

              console.log("STDOUT : ", stdout)
              console.log("STDERR : ", stderr)
              return true
            }
          )
          break
        // LINUX OS
        case "linux":
          console.log("LINUX BOX DETECTED")
          await childProcess.exec(
            `id -u ${args.name}`,
            async (err, stdout, stderr) => {
              console.log("EXEC RUN")
              if (err) {
                console.log("ERROR CHECKING USER", err)
                return false
              }

              console.log("STDOUT : ", stdout)
              console.log("STDERR : ", stderr)
              return true
            }
          )
          break
        default:
          break
      }
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : create the user
      switch (platform) {
        // MAC OS
        case "darwin":
          console.log("MAC BOX DETECTED")
          await childProcess.exec(
            `dscl . -create /Users/${args.name}`,
            async (err, stdout, stderr) => {
              console.log("EXEC RUN TO CREATE USER")
              if (err) {
                console.log("ERROR CREATING USER", err)
                return false
              }

              console.log("STDOUT : ", stdout)
              console.log("STDERR : ", stderr)
              return true
            }
          )
          break
        // LINUX OS
        case "linux":
          console.log("LINUX BOX DETECTED")

          break
        default:
          break
      }
      return true
    } catch (error) {
      return false
    }
  }
}
