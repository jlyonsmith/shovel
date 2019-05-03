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
        return await exec("dscl . -list /Groups").then((result) => {
          return result.stdout.includes(args.name)
        })
      } else {
        return await exec("groups").then((result) => {
          return result.includes(args.name)
        })
      }
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      if (osPlatform === "darwin") {
        let groupAdd = await exec(`sudo dscl . create /Groups/${args.name}`)
        return groupAdd.stdout
      } else {
        return await exec(`groupadd ${args.name}`)
      }
    } catch (error) {
      return false
    }
  }
}

module.exports = GroupExists
