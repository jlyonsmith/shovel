# `DirectoryDeleted`

## Summary

Asserts that a directory is deleted (and all it's children) from the host.

## Arguments

### `directory: String`

The directory to delete.

## Example

```json5
{
  assert: "DirectoryDeleted",
  with: {
    directory: "/path/to/dir"
  }
}
```
