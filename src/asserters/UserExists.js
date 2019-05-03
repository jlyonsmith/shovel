const fs = require("fs-extra")
const childProcess = require("child_process")

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
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : create the user
      return true
    } catch (error) {
      return false
    }
  }
}
