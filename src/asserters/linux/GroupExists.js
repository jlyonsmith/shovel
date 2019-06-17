const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

/*
Checks and ensures that a group exists.

Example:

{
  assert: "groupExists",
  with: {
    name: "groupName"
  }
}
*/

const osPlatform = os.platform()

class GroupExists {
  async assert(args) {
    try {
      if (osPlatform === "darwin") {
        let result = await exec("dscl . -list /Groups", args)
        return result.stdout.includes(args.name)
      } else {
        let result = await exec("groups")
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
        await exec(`dscl . create /Groups/${args.name}`, args)
        return true
      } else {
        await exec(`groupadd ${args.name}`)
        return true
      }
    } catch (error) {
      return false
    }
  }
}
module.exports = GroupExists
