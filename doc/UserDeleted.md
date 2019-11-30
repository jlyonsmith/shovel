# `UserDeleted`

## Summary

Asserts that a Linux user has been deleted.

## Arguments

### `user: string`

The name of the user.

## Example

```json5
{
  assert: "UserDeleted",
  with: {
    user: "name",
  }
}
```
