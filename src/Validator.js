import validate from "validate.js"

validate.validators.isArray = (value, options, key, attributes) => {
  if (value === null || value === undefined) {
    // typechecking should not validate presence/existence. That happens separately, so an undefined value here should not trigger a validation error
    return null
  }
  const isArray = Array.isArray(value)
  return isArray === options ? null : `must be an Array.`
}

validate.validators.isString = (value, options, key, attributes) => {
  if (value === null || value === undefined) {
    // typechecking should not validate presence/existence. That happens separately, so an undefined value here should not trigger a validation error
    return null
  }
  const isString = typeof value === "string"
  return isString === options ? null : `must be a String.`
}

validate.validators.isObject = (value, options, key, attributes) => {
  if (value === null || value === undefined) {
    // typechecking should not validate presence/existence. That happens separately, so an undefined value here should not trigger a validation error
    return null
  }
  const isObject =
    typeof value === "object" && value !== null && !Array.isArray(value)
  return isObject === options ? null : `must be an Object.`
}

validate.validators.isAssertion = (value, options, key, attributes) => {
  if (!value.length > 0) {
    return "The assertions array is empty. It must contain at least one assertion."
  }
  for (let val in value) {
    const currentValue = value[val]
    if (!currentValue.assert || !currentValue.with) {
      return "At least one assertion is missing an 'assert' or a 'with' attribute."
      break
    }
  }
  return null
}

export default validate
