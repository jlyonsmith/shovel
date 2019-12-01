# `SystemPackageRemoved`

## Summary

Asserts that a system package is removed from the system.

## Arguments

### `package: string` (Required)

The name of the package to remove.

## Example

```json5
{
  assert: "SystemPackageRemoved",
  with: {
    package: "gzip",
  }
}
```
