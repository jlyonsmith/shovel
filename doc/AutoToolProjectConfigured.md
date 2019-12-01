# `AutoToolProjectConfigured`

## Summary

Asserts that an [AutoTool](https://www.gnu.org/software/automake/manual/html_node/Autotools-Introduction.html) based project `configure` script has been run.

## Arguments

### `directory: String`

The path to the project root directory.

### `args: String`

Arguments to pass to the `configure` command.

## Example

```json5
{
  assert: "AutoToolProjectConfigured",
  with: {
    directory: "/path/to/project",
    args: "--prefix /usr/local",
  }
}
```
