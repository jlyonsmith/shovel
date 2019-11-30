# `ServiceRunning`

## Summary

Asserts that a system service is running.

## Arguments

### `service: string`

The name of the service.

## Example

```json5
{
  assert: "ServiceRunning",
  with: {
    service: "ntp",
  }
}
```
