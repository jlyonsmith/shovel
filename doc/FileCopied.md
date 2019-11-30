# `FileDeleted`

## Summary

Asserts that a file is deleted from the host.

## Arguments

### `file: string`

The file to ensure is deleted.

## Example

```json5
{
  assert: "FileCopied",
  with: {
    fromFile: "/path/somefile.txt",
    toFile: "/path/someother.txt",
  }
}
```
