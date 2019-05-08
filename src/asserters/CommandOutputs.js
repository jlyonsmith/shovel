const { exec } = require("child_process")

/*
Execute a command and check for regex output

Example:

    {
      description: "Verify expected version" ,
      assert: "CommandOutputs",
      with: {
        command: "consul --version",
        regex: "^Consul\\sv${consulVersion}$",
        occurance: 1,
      },
    }
*/

class CommandOutput {
  async assert(args) {
    return false // always actualize (test)
  }

  async actualize(args) {
    try {
      const result = await this.execCommand(args.command)
      const expectOccurrence = args.occurrence || 1
      console.log(`Returned: "${result}"`)
      const matched = result.match(args.regex)
      console.log(
        `Matched: regex: ${args.regex} match: ${JSON.stringify(
          matched,
          null,
          2
        )} expectOccurence: ${expectOccurrence}`
      )

      return !!(matched && matched.length == expectOccurrence)
    } catch (error) {
      console.log(`Error executing command: ${JSON.stringify(error)}`)
      return false
    }
  }

  async execCommand(command) {
    return new Promise(function(resolve, reject) {
      exec(command, (err, stdout, stderr) => {
        if (err) {
          //console.log(`Error executing: ${err}`)
          reject(err)
        }
        //console.log(`Result: ${stdout}`)
        resolve(stdout)
      })
    })
  }
}

module.exports = CommandOutput
