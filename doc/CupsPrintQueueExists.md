# `CupsPrintQueueExists`

## Summary

Asserts that a CUPS printer queue exists on the host. Fails if CUPS is not installed.

## Arguments

### `queue: string` (Required)

The print queue name.

### `deviceUri: string` (Required)

The device URI for the printer, e.g. ipp://10.10.1.1:631/printer, serial:/

### `ppdFile: string` (Defaults to nothing)

The file name of a [PPD](https://www.cups.org/doc/postscript-driver.html) file for the printer.

### `enabled: boolean` (Defaults to `true`)

If the print queue is enabled.

### `location: string` (Defaults to empty)

The printer location.

### `description: string` (Defaults to empty)

The printer desription

### `ppdFile: string` (Defaults to empty)

The name of the PPD file to use for this printer

### `ppdOptions: string` (Defaults to empty)

The PPD options to use for this printer.  Not valid unless `ppdFile` is also set.

### `shared: boolean` (Defaults to `false`)

The print queue name.

### `errorPolicy: string` (Defaults to `stop-printer`)

Printer error policy.  One of `abort-job`, `stop-printer`, `retry-job`, `retry-current-job`.

## Example

```json5
{
  assert: "CupsPrintQueueExists",
  with: {
    queue: "my-printer",
    shared: true,
  }
}
```
