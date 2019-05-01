export function getMockFS() {
  return {
    lstat: jest.fn((path) => {
      if (path === "/somefile") {
        return Promise.resolve({ isFile: () => true, isDirectory: () => false })
      } else if (path === "/somedir") {
        return Promise.resolve({ isDirectory: () => true, isFile: () => false })
      } else {
        return Promise.reject(new Error())
      }
    }),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
  }
}
