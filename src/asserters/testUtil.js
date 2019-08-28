export const createAssertNode = (asserter, args) => {
  const filename = "a.json5"
  let line = 0

  const createNode = (value) => {
    let type = typeof value
    let newValue

    if (type === "object") {
      if (Array.isArray(value)) {
        type = "array"
        newValue = value.map(createNode)
      } else {
        newValue = {}

        Object.entries(value).map(([k, v]) => {
          newValue[k] = createNode(v)
        })
      }
    } else {
      newValue = value
    }

    const node = { line, column: 0, filename, type, value: newValue }

    line += 1

    return node
  }

  return createNode({
    assert: asserter.constructor.name,
    with: args,
  })
}
