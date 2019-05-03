const childProcess = jest.genMockFromModule("child_process")

let mockFiles = Object.create(null)
function __setMockFiles(newMockFiles) {
  mockFiles = Object.create(null)
  for (const file in newMockFiles) {
    mockFiles[file] = newMockFiles[file]
  }
}
childProcess.__setMockFiles = __setMockFiles

childProcess.exec = jest.fn((name) => {
  console.log("&&&&&&&&", mockFiles, name)
  return mockFiles[name]
  //   switch (name) {
  //     case "existentUser":
  //       return Promise.resolve({ exec: mockFiles[] })

  //       break
  //     case "nonExistentUser":
  //       return Promise.resolve({ exec: () => true })

  //       break
  //     case "existentGroup":
  //       return Promise.resolve({ exec: () => true })

  //       break
  //     case "nonExistentGroup":
  //       return Promise.resolve({ exec: () => true })

  //       break
  //     default:
  //       return Promise.reject(new Error())
  //       break
  //   }
})

module.exports = childProcess
