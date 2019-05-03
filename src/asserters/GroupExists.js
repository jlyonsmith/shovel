const fs = require("fs-extra")

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

export class GroupExists {
  async assert(args) {
    try {
      // TODO : check if group exists using something from https://stackoverflow.com/questions/29073210/how-to-check-if-a-group-exists-and-add-if-it-doesnt-in-linux-shell-script
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : create the group
      return true
    } catch (error) {
      return false
    }
  }
}
