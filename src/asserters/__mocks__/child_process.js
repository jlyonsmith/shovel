const util = require("util")
const childProcess = jest.genMockFromModule("child_process")

let mockFiles = Object.create(null)
function __setMockFiles(newMockFiles) {
  mockFiles = Object.create(null)
  for (const file in newMockFiles) {
    mockFiles[file] = newMockFiles[file]
  }
}
childProcess.__setMockFiles = __setMockFiles

async function exec(name, args, cb) {
  cb(null, mockFiles[args.name], null)
}

childProcess.exec = exec

module.exports = childProcess
