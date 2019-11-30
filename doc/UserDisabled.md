# `UserDisabled`

## Summary

Asserts that a Linux user has been disabled.

## Arguments

### `user: string`

The name of the user.

## Example

```json5
{
  assert: "UserDisabled",
  with: {
    user: "name",
  }
}
```
