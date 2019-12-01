# `FileExtracted`

## Summary

Asserts that a `.tar`, `.tar.gz` or `.tgz` file has been extracted by comparing the sizes of the files in `tarFile` with the files in `toDirectory`.

## Arguments

### `zipFile: string`

The file to unzip.

### `toDirectory: string`

The directory in which to place the unzipped files.

## Example

```json5
{
  assert: "FileExtracted",
  with: {
    tarFile: "archive.tgz",
    toDirectory: "/some/dir",
  }
}
```
