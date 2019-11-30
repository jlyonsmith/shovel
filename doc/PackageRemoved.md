# `PackageRemoved`

## Summary

Asserts that a system package is removed from the system.

## Arguments

### `package: string`

The name of the package to remove.

## Example

```json5
{
  assert: "PackageRemoved",
  with: {
    package: "gzip",
  }
}
```
