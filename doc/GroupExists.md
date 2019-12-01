# `GroupExists`

## Summary

Asserts that a Linux security group exists.

## Arguments

### `group: string` (Required)

The name of the group to create.

### `gid: number` (Optional)

The desired group id number

## Example

```json5
{
  assert: "FileDeleted",
  with: {
    group: "group-name",
  }
}
```
