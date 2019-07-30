export class ScriptError extends Error {
  constructor(message, fileName, node = { line: 0, column: 0 }) {
    const lineNumber = node.line
    const columnNumber = node.column

    super(message, fileName, lineNumber, columnNumber)
    this.message += ` (${fileName}:${lineNumber}:${columnNumber})`
  }

  // Otherwise "Error: " is prefixed
  toString() {
    return this.message
  }
}
