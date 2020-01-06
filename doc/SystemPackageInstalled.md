# `SystemPackageInstalled`

## Summary

Asserts that a system package is installed.

## Arguments

### `package: string` (Required)

Then name of the package to install.

### `update: boolean` (Optional)

Whether to update the package lists.  Only done if an install is actually needed.

## Example

```json5
{
  assert: "SystemPackageInstalled",
  with: {
    package: "gzip",
  }
}
```
