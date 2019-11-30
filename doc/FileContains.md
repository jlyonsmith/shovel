# `FileContains`

## Summary

Asserts that a file contains some content.  You can either:

- Replace the entire file contents
- Replace some section of the file
- Insert content before some existing content
- Insert content after some existing content

## Arguments

### `file: string`

The file to unzip.

### `content: string`

The directory in which to place the unzipped files.

### `position: string`

The desired position of the `content`, one of:

- `before` to place the `content` before the `regex`.  The assert fails if `regex` is not found in the file, or `content` does not appear before it.
- `after` to place the `content` after the `regex`. The assert fails if the `regex` is not found in the file, or `content` does not appear after it.
- `over` to place the `content` over the `regex`.  If no `regex` is specified for this option, then the entire file contents are replaced.  If the `regex` is not found, then the assert succeeds if the `content` is found in the file, otherwise it fails.

### `regex: string`

The regular expression to match.  The meaning of this match is dependent on `position`.

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
