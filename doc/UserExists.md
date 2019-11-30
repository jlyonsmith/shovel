# `UserExists`

## Summary

Asserts that a Linux user exists.

## Arguments

### `user: string`

The name of the user.

## Example

```json5
{
  assert: "UserExists",
  with: {
    user: "name",
  }
}
```
