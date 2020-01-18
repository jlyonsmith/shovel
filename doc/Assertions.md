# Assertions

The `assertions` section is an array of assertions to make about the target host.  It is run in order from top to bottom.

## Properties

### `description: string` (Optional)

A description explaining the purpose of the assertion.

### `assert: string` (Required)

The asserter to run.  See the section below

### `with: object` (Required)

Arguments to be passed to the asserter.

### `become: string` (Optional)

Name of a user to become before running the asserter.  Currently only `root` is supported.

### `when: boolean` (Optional)

A boolean that is evaluated to see if the assertion should be run at all.

## Asserters

Here is an alphabetical list of the built-in asserters:

- [`AutoToolProjectConfigured`](./AutoToolProjectConfigured.md)
- [`AutoToolProjectMade`](./AutoToolProjectMade.md)
- [`CupsPrintQueueExists`](./CupsPrintQueueExists.md)
- [`DirectoryDeleted`](./DirectoryDeleted.md)
- [`DirectoryExists`](./DirectoryExists.md)
- [`DirectoryZipped`](./DirectoryZipped.md)
- [`FileDeleted`](./FileDeleted.md)
- [`FileContains`](./FileContains.md)
- [`FileCopied`](./FileCopied.md)
- [`FileExists`](./FileExists.md)
- [`FileDeleted`](./FileDeleted.md)
- [`FilesDeleted`](./FilesDeleted.md)
- [`GroupDeleted`](./GroupDeleted.md)
- [`GroupExists`](./GroupExists.md)
- [`SystemPackageInstalled`](./SystemPackageInstalled.md)
- [`SystemPackageRemoved`](./SystemPackageRemoved.md)
- [`ServiceRunning`](./ServiceRunning.md)
- [`ServiceStopped`](./ServiceStopped.md)
- [`TarFileExtracted`](./TarFileExtracted.md)
- [`UserDeleted`](./UserDeleted.md)
- [`UserDisabled`](./UserDisabled.md)
- [`UrlDownloaded`](./UrlDownloaded.md)
- [`UserExists`](./UserExists.md)
- [`ZipFileUnzipped`](./ZipFileUnzipped.md)
