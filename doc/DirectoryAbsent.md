# `DirectoryAbsent`

## Summary

Asserts that a directory is absent from the system. If not absent the directory is deleted.

The directory can have contents.

## Arguments

### `path: String`

The path to the directory.

## Possible Errors

- The `path` points to a file instead of a directory.
- `path` is not a `String`
- The user does not have permission to remove the directory

## Example

```json5
{
  assert: "DirectoryAbsent",
  with: {
    path: "/path/to/dir"
  }
}
```
