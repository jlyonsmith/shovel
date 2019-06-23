import { OctopusTool } from "./OctopusTool"

const toolName = "octopus"

function getMockLog() {
  return {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }
}

function getOutput(fn) {
  const calls = fn.mock.calls
  if (calls.length > 0 && calls[0].length > 0) {
    return calls[0][0]
  } else {
    return ""
  }
}

test("--help", async () => {
  const mockLog = getMockLog()
  const tool = new OctopusTool(toolName, mockLog)
  const exitCode = await tool.run(["--help"])

  expect(exitCode).toBe(0)
  expect(getOutput(mockLog.info)).toEqual(expect.stringContaining("--help"))
})

test("--version", async () => {
  const mockLog = getMockLog()
  const tool = new OctopusTool(toolName, mockLog)
  const exitCode = await tool.run(["--version"])

  expect(exitCode).toBe(0)
  expect(getOutput(mockLog.info)).toEqual(expect.stringMatching(/\d\.\d\.\d/))
})
