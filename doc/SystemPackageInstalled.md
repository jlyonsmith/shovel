# `SystemPackageInstalled`

## Summary

Asserts that a system package is installed.

## Arguments

### `package: string` (Required)

Then name of the package to install.

## Example

```json5
{
  assert: "SystemPackageInstalled",
  with: {
    package: "gzip",
  }
}
```
