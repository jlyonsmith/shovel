# `AutoToolProjectMade`

## Summary

Asserts that a specified target of an [AutoTool](https://www.gnu.org/software/automake/manual/html_node/Autotools-Introduction.html) base project has been made with the `make` command.

## Arguments

### `directory: String` (Required)

The path to the project root directory.

### `args: String` (Optional)

Additional arguments for building the project.

## Possible Errors

- The `directory` does not exist or the user does not have read/write permission.
- There is not a `Makefile` in the project root, meaning you probably did not do a [`AutoToolProjectConfigured`](./AutoToolProjectConfigured.md) assert first.

## Example

```json5
{
  assert: "AutoToolProjectMade",
  with: {
    directory: "/path/to/project",
    args: "-D ARG=xyz",
  }
}
```
