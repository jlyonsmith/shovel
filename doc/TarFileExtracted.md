# `TarFileExtracted`

## Summary

Asserts that a `.tar`, `.tar.gz` or `.tgz` file has been extracted by comparing the sizes of the files in `tarFile` with the files in `toDirectory`.

## Arguments

### `file: string` (Required)

The file to unzip.

### `toDirectory: string` (Optional)

The directory in which to place the unzipped files. Defaults to the same directory as the tar file.

## Example

```json5
{
  assert: "TarFileExtracted",
  with: {
    file: "archive.tgz",
    toDirectory: "/some/dir",
  }
}
```
