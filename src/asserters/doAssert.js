const fs = require("fs")
const registryPath = "./asserters.json"
class DoAssert {
  constructor() {
    this.registry = null
  }

  async run(args) {
    //console.log(`Run assertion args:${JSON.stringify(args)}`)

    const asserterName = args[0]
    let data
    try {
      data = this.getArgData(args)
    } catch (ex) {
      return 1
    }

    const asserter = await this.getAsserter(asserterName)
    if (asserter) {
      const constName = asserter.constructor.name
      // console.log(`Asserter: ${constName} (${JSON.stringify(data)})`)

      const assertionTrue = await asserter.assert(data)
      if (!assertionTrue) {
        // console.log(
        //   `Running asserter ${constName} with ${JSON.stringify(data)}`
        // )
        try {
        const success = await asserter.run(data)
          console.log(`Asserter Run. Success: ${success}`)
        } catch (ex) {
          console.error(`Error executing assertion action: ${ex.message}`)
          return 1
        }
      } else {
        console.log(`Assertion true. No action requred`)
      }

      return 0
    } else {
      process.stderr.write(
        `Error: asserter \"${asserterName}\" does not exist\n`
      )
      return 1
    }
  }

  getArgData(args) {
    const encoding = args[1]
    const encodedData = args[2]
    let dataString = encodedData
    if (encoding == "base64") {
      dataString = Buffer.from(encodedData, "base64").toString("ascii")
    }

    return JSON.parse(dataString)
  }

  async getAsserterInfo(asserterName) {
    const registry = await this.getRegistry()
    return registry[asserterName]
  }

  async getAsserter(asserterName) {
    const info = await this.getAsserterInfo(asserterName)
    // console.log(`getAsserterInfo for ${asserterName} : ${JSON.stringify(info)}`)
    if (info) {
      const asserterClass = require(`./${info.module}`)
      const container = {} // pass in logger at least
      const asserter = new asserterClass(container)
      return asserter
    } else {
      return null
    }
  }

  async getRegistry() {
    if (!this.registry) {
      this.registry = await this.loadRegistry()
    }
    return this.registry
  }

  async loadRegistry() {
    return new Promise(function(resolve, reject) {
      fs.readFile(registryPath, function(err, content) {
        if (err) {
          reject("Cannot read registry file")
        } else {
          const data = JSON.parse(content)
          resolve(data)
        }
      })
    })
  }
}

const runner = new DoAssert()
const result = runner
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch((error) => {
    process.exitCode = 200

    if (error) {
      console.error(error.message)
    }
  })
