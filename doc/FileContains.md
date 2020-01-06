# `FileContains`

## Summary

Asserts that a file contains some content.  You can either:

- Replace the entire file contents
- Replace some section of the file
- Insert content before some existing content
- Insert content after some existing content

## Arguments

### `file: string`

The file to check the contents of.

### `content: string`

The content to place in the file.

### `position: string`

The desired position of the `content`, one of:

- `before` to place the `content` before the `regex`.  The assert throws if `regex` is not found in the file. If `content` does not appear before it, then the content is inserted.
- `after` to place the `content` after the `regex`. The assert thrown if the `regex` is not found in the file. If `content` does not appear after it then the content is inserted.
- `over` to place the `content` over the `regex`.  If the content is found, then the assert succeeds, If the `regex` is found the new content replaces it, otherwise the new content is added at the end of the file.
- `all` to replace the contents of the file with `content`.  If the file already contains `content` then the assert succeeds, otherwise it fails.

### `regex: string`

The regular expression to match. The meaning of this match is dependent on `position`.

## Example

```json5
{
  assert: "FileContains",
  with: {
    file: "/etc/config",
    position: "over",
    regex: "^#ConfigLine=yes",
    content: "ConfigLine=no",
  }
}
```
