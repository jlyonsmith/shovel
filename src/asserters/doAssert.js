//const DirectoryExistsAsserter = require("./system/directoryExists")
const fs = require("fs")
const registryPath = "./asserters.json"
class DoAssert {
  constructor() {
    console.log("construct assertion runner")
    this.registry = null
  }

  async run(args) {
    console.log(`Run assertion args:${JSON.stringify(args)}`)

    const asserterName = args[0]
    const dataArg = args[1]
    const data = JSON.parse(dataArg)
    console.log(`Run ${asserterName}  data: ${JSON.stringify(data, null, 2)}`)
    // const assertClass = require(`./${assertion}`)
    // const asserter = new assertClass()
    // const registry = await this.getRegistry()
    // console.log(JSON.stringify(registry, null, 2))

    const asserter = await this.getAsserter(asserterName)
    if (asserter) {
      const constName = asserter.constructor.name
      console.log(`Asserter: ${constName}`)

      const result = await asserter.assert(data)
      console.log(result)
      if (!result.assertion) {
        const success = await asserter.run(data)
      } else {
        process.stderr.write("Nothing to see here... Move Along.\n")
      }

      return 0
    } else {
      console.error(`asserter ${asserterName} does not exist`)
      return 1
    }
  }

  async getAsserterInfo(asserterName) {
    const registry = await this.getRegistry()
    return registry[asserterName]
  }

  async getAsserter(asserterName) {
    const info = await this.getAsserterInfo(asserterName)
    console.log(`getAsserterInfo for ${asserterName} : ${JSON.stringify(info)}`)
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
