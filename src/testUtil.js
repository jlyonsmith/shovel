export const createNode = (filename, value) => {
  const innerCreateNode = (v) => {
    let t = typeof v
    let nv

    if (v !== null && t === "object") {
      if (Array.isArray(v)) {
        t = "array"
        nv = v.map((i) => innerCreateNode(i))
      } else {
        nv = {}
        Object.entries(v).map(([k, v]) => {
          nv[k] = innerCreateNode(v)
        })
      }
    } else {
      nv = v
    }

    return { filename, line: 0, column: 0, type: t, value: nv }
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
