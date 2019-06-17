const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

/*
Checks and ensures that a group is absent.

Example:

{
  assert: "groupAbsent",
  with: {
    name: "nonExistentGroup"
  }
}
*/

class GroupAbsent {
  async assert(args) {
    const osPlatform = os.platform()

    try {
      if (osPlatform === "darwin") {
        let result = await exec("dscl . -list /Groups", args)
        return !result.stdout.includes(args.name)
      } else {
        let result = !(await exec("groups", args))
        return result.includes(args.name)
      }
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    // TODO: Must be root
    try {
      if (osPlatform === "darwin") {
        await exec(`dscl . delete /Groups/${args.name}`, args)
        return true
      } else {
        await exec(`groupdel ${args.name}`, args)
        return true
      }
    } catch (error) {
      return false
    }
  }
}

module.exports = GroupAbsent
