const fsExtra = jest.genMockFromModule("fs-extra")

fsExtra.lstat = jest.fn((path) => {
  if (path === "/somefile") {
    return Promise.resolve({ isFile: () => true, isDirectory: () => false })
  } else if (path === "/somedir") {
    return Promise.resolve({ isDirectory: () => true, isFile: () => false })
  } else {
    return Promise.reject(new Error())
  }
})

export default fsExtra
