# `GroupDeleted`

## Summary

Asserts that a Unix security group is deleted from the host.

## Arguments

### `group: string`

The name of the group to delete

## Example

```json5
{
  assert: "GroupDeleted",
  with: {
    group: "group-name",
  }
}
```
