# Permission Flags

Permission or `mode` flags can be specified for files and directories. Permissions are specified for `user`, `group` and `other` as follows:

| Position | Characters | Meaning                                         |
| -------- | ---------- | ----------------------------------------------- |
| 0        | `r` or `-` | Readabled                                       |
| 1        | `w` or `-` | Writeable                                       |
| 2        | `x` or `-` | Executable (files) or traversable (directories) |

## Example

```json5
{
  ...
  mode: {
    user: "rwx",
    group: "rwx",
    other: "r--",
  }
  ...
}
```
