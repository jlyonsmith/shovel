import fs from "fs-extra"

/*
Checks and ensures that a user is disabled.

Example:

{
  assert: "userDisabled",
  with: {
    name: "userName"
  }
}
*/

export class UserDisabled {
  async assert(args) {
    try {
      // TODO : check if user is disabled using something from https://www.thegeekdiary.com/unix-linux-how-to-lock-or-disable-an-user-account/
      return false
    } catch (error) {
      return false
    }
  }

  async actualize(args) {
    try {
      // TODO : disable the user
      return true
    } catch (error) {
      return false
    }
  }
}
