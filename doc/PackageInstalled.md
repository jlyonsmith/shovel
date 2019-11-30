# `PackageInstalled`

## Summary

Asserts that a system package is installed.

## Arguments

### `package: string`

Then name of the package to install.

## Example

```json5
{
  assert: "PackageInstalled",
  with: {
    package: "gzip",
  }
}
```
