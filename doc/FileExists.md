# `FileExists`

## Summary

Asserts that a file exists.  If not, the file is created. The directory can have contents.

## Arguments

### `path: String`

The path to the directory.

### `owner: String`

The user and group owners for the file.  Defaults to current user and group.

### `mode: String`

The permissions flags for the file.  Defaults to `{ user: "rwx", group: "r--", other: "r--" }`.  See [Permission Flags](PermissionFlags.md)

## Possible Errors

- The `path` points to a file instead of a directory.
- `path` is not a `String`
- The user does not have permission to remove the directory

## Example

```json5
{
  assert: "FileExists",
  with: {
    path: "/path/to/file"
    owner: {
      user: "user",
      group: "group",
    }
    mode: {
      user: "rwx",
      group: "rwx",
      other: "rwx",
    }
  }
}
```
