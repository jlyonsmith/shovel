# `DirectoryZipped`

## Summary

Asserts that a directory has been zipped by comparing the sizes of the files in `fromDirectory` with the files in `zipFile`.

## Arguments

### `fromDirectory: string`

The directory from which to recursively zip files.

### `zipFile: string`

The location of the zip file.

## Example

```json5
{
  assert: "DirectoryZipped",
  with: {
    fromDirectory: "/some/dir",
    zipFile: "zipfile.gz",
  }
}
```
