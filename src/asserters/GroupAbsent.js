const util = require("util")
const exec = util.promisify(require("child_process").exec)

/*
Checks and ensures that a group is absent.

Example:

{
  assert: "groupAbsent",
  with: {
    name: "groupName"
  }
}
*/

export class GroupAbsent {
  async assert(args) {
    try {
      return !(await exec("groups").then((result) => {
        return result.includes(args.name)
      }))
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      eturn await exec(`groupdel ${args.name}`)
    } catch (error) {
      return false
    }
  }
}

module.exports = GroupAbsent
