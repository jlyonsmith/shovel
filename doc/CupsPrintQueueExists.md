# `CupsPrintQueueExists`

## Summary

Asserts that a CUPS printer queue exists on the host. Fails if CUPS is not installed.  Requires that `DirtyCleanInterval` is set to zero (`0`) in the `/etc/cups/cupsd.conf` file.

## Arguments

### `queue: string` (Required)

The print queue name.

### `deviceUri: string` (Required)

The device URI for the printer, e.g. ipp://10.10.1.1:631/printer, serial:/

### `errorPolicy: string` (Defaults to `stop-printer`)

Printer error policy.  One of `abort-job`, `stop-printer`, `retry-job`, `retry-current-job`.

### `accepting: boolean` (Defaults to `true`)

If the print queue is enabled and accepting print jobs.

### `shared: boolean` (Defaults to `false`)

If the printer queue is shared on the network.

### `location: string` (Defaults to empty)

The printer location.

### `info: string` (Defaults to empty)

The printer information, typically the model number and other descriptive notes.

### `ppdFile: string` (Defaults to empty)

The file name of a [PPD](https://www.cups.org/doc/postscript-driver.html) file for the printer.

### `ppdOptions: string` (Defaults to empty)

The PPD options to use for this printer.  Not valid unless `ppdFile` is also set.

## Example

```json5
{
  assert: "CupsPrintQueueExists",
  with: {
    queue: "my-printer",
    deviceUri: "socket://10.10.10.10/laserjet",
    shared: true,
    accepting: true,
    location: "Main Office",
    description: "HP LaserJet",
    errorPolicy: "retry-job",
    ppdFile: "/usr/local/drivers/HPLaserJet.ppd",
    ppdOptions: {
      PrintQuality: "Best",
    }
  }
}
```
