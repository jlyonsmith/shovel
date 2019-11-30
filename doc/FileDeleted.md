# `FileDeleted`

## Summary

Asserts that a file is deleted from the host.

## Arguments

### `file: string`

The file to ensure is deleted.

## Example

```json5
{
  assert: "FileDeleted",
  with: {
    file: "/path/somefile.txt",
  }
}
```
