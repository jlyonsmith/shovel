# `GroupExists`

## Summary

Asserts that a Unix security group exists.

## Arguments

### `group: string`

The group to create.

## Example

```json5
{
  assert: "FileDeleted",
  with: {
    group: "group-name",
  }
}
```
