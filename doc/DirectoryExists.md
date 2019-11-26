# `DirectoryExists`

## Summary

Asserts that a directory is exists and has the specific owners and permissions. The parent directory must exist and be accessible by the user.

## Arguments

### `path: String`

The path to the directory.

### `owner: String`

The user and group owners for the directory. Defaults to current user and group.

### `mode: String`

The permissions flags for the directory.  Defaults to `{ user: "rwx", group: "r--", other: "r--" }`.  See [Permission Flags](PermissionFlags.md)

## Possible Errors

- `path` is not a `String`
- The parent directory is not accessible by this user

## Example

```json5
{
  assert: "DirectoryExists",
  with: {
    path: "/path/to/dir",
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
