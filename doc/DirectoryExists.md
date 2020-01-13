# `DirectoryExists`

## Summary

Asserts that a directory is exists and has the specific owners and permissions. The parent directory must exist and be accessible by the user.

## Arguments

### `directory: String`

The directory.

### `owner: String`

The user and group owners for the directory. Defaults to current user and group.

### `mode: String`

The permissions flags for the directory.  For directories to `{ user: "rwx", group: "rwx", other: "rwx" }`.  See [Permission Flags](PermissionFlags.md)

## Example

```json5
{
  assert: "DirectoryExists",
  with: {
    directory: "/path/to/dir",
    owner: {
      user: "joe",
      group: "admins",
    },
    mode: {
      user: "rwx",
      group: "rwx",
      other: "r--",
    }
  }
}
```
