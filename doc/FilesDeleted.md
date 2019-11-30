# `FilesDeleted`

## Summary

Asserts that one or more files are deleted from the host. If present, the files are deleted.

## Arguments

### `files: [string]`

An array of files to delete.

## Example

```json5
{
  assert: "DirectoryDeleted",
  with: {
    directory: "/path/to/dir"
  }
}
```
