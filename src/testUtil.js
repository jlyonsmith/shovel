export const createNode = (filename, value) => {
  const innerCreateNode = (value) => {
    let type = typeof value
    let newValue

    if (type === "object") {
      if (Array.isArray(value)) {
        type = "array"
        newValue = value.map((i) => innerCreateNode(i))
      } else {
        newValue = {}

        Object.entries(value).map(([k, v]) => {
          newValue[k] = innerCreateNode(v)
        })
      }
    } else {
      newValue = value
    }

    return { filename, line: 0, column: 0, type, value: newValue }
  }

  return innerCreateNode(value)
}

export const createAssertNode = (asserter, args) => {
  return createNode("a.json5", {
    assert: asserter.constructor.name,
    with: args,
  })
}

export const createScriptNode = (filename) => {
  return createNode(filename, {
    options: {},
    vars: {},
    includes: [],
    assertions: [],
  })
}
