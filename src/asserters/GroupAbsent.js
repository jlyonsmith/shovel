const fs = require("fs-extra")

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
      // TODO : check if group is absent using something from https://stackoverflow.com/questions/29073210/how-to-check-if-a-group-exists-and-add-if-it-doesnt-in-linux-shell-script
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : remove the group
      return true
    } catch (error) {
      return false
    }
  }
}
