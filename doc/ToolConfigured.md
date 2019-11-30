# `ToolConfigured`

## Summary

Asserts that an [AutoTool](https://www.gnu.org/software/automake/manual/html_node/Autotools-Introduction.html) base project `configure` script has been run, and if not run it.

## Arguments

### `directory: String`

The path to the project root directory.

### `args: String`

Arguments to pass to the `configure` command.

## Possible Errors

- The `directory` does not exist or the user does not have read/write permission.
- There is not `configure` script in the project root.

## Example

```json5
{
  assert: "ToolConfigured",
  with: {
    directory: "/path/to/project",
    args: "--prefix /usr/local",
  }
}
```
