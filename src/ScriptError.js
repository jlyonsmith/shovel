export class ScriptError extends Error {
  constructor(message, node) {
    super(message, node.filename, node.line, node.column)
    this.message += ` (${node.filename}:${node.line}:${node.column})`
  }

  // Otherwise "Error: " is prefixed
  toString() {
    return this.message
  }
}
