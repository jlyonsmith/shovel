const util = require("util")
const exec = util.promisify(require("child_process").exec)
const execFile = util.promisify(require("child_process").execFile)
/*
Checks and ensures that a file exists.

Example:

{
  assert: "groupExists",
  with: {
    name: "groupName"
  }
}
*/

class GroupExists {
  async assert(args) {
    try {
      return await exec("groups").then((result) => {
        return result.includes(args.name)
      })
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      return await execFile(`groupadd ${args.name}`)
    } catch (error) {
      return false
    }
  }
}

module.exports = GroupExists
