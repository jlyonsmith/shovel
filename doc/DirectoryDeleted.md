# `DirectoryDeleted`

## Summary

Asserts that a directory is deleted from the host. If present, the directory is deleted recursively.

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
