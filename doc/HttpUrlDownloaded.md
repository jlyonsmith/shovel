# `HttpUrlDownloaded`

## Summary

Asserts that a file has been downloaded from a URL with HTTP or HTTPS.

## Arguments

### `url: String` (Required)

The HTTP/HTTPS URL of the file to be downloaded.

### `digest: String` (Required)

The SHA256 digest of the file in hexadecimal.

### `file: String` (Required)

The name of the downloaded file.

## Example

```json5
{
  assert: "HttpUrlDownloaded",
  with: {
    url: "https://sourcehost.com/linux_amd64.zip",
    digest: "658f4f3b305cd357a9501728b8a1dc5f...",
    file: "{path.join(env.HOME, '/downloads/linux_amd64.zip'}",
  }
}
```
