# `HttpUrlDownloaded`

## Summary

Asserts that a has been downloaded from a URL. If not, the file is downloaded.

## Arguments

### `url: String`

The HTTP/HTTPS URL of the file to be downloaded.

### `digest: String`

The SHA256 digest of the file in hexadecimal.

### `directory: String`

The directory into which the dowloaded file should be placed.

## Possible Errors

- `url` is not valid
- `directory` is not an existing directory
- The user does not have permission to write to `directory`

## Example

```json5
{
  assert: "HttpUrlDownloaded",
  with: {
    url: "https://sourcehost.com/linux_amd64.zip",
    digest: "658f4f3b305cd357a9501728b8a1dc5f...",
    directory: "{path.join(env.HOME, '/downloads'}",
  }
}
```
