const fs = require("fs-extra")

/*
Checks and ensures that a user is enabled.

Example:

{
  assert: "userEnabled",
  with: {
    name: "userName"
  }
}
*/

export class UserEnabled {
  async assert(args) {
    try {
      // TODO : check if user is enabled using something from https://www.thegeekdiary.com/unix-linux-how-to-lock-or-disable-an-user-account/
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : enable the user
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = UserEnabled
