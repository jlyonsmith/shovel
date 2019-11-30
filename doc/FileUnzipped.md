# `FileUnzipped`

## Summary

Asserts that a `.gz` or `.zip` file has been unzipped by comparing the sizes of the files in `zipFile` with the files in `toDirectory`.

## Arguments

### `zipFile: string`

The file to unzip.

### `toDirectory: string`

The directory in which to place the unzipped files.

## Example

```json5
{
  assert: "DirectoryAbsent",
  with: {
    zipFile: "zipfile.gz",
    toDirectory: "/some/dir",
  }
}
```
