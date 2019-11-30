# `ServiceStopped`

## Summary

Asserts that a system service is stopped.

## Arguments

### `service: string`

The service to stop.

## Example

```json5
{
  assert: "ServiceStopped",
  with: {
    service: "ntp",
  }
}
```
