# Octopus: Simple, agentless IT automation

Octopus is a system for performing IT automation.  It's written in and makes use of Javascript and Node.js.  Script files are created in [JSON5](https://json5.org/) format that consist of a sequence of idempotent command invocations or *actions* that change the state of the target system.  Script idempotency means that after one run of a script to set things into a desired state, subsequent runs of the same script result in no changes to the target.

## Installation

Install the package globally:

```
npm install -g @johnls/octopus
octopus --help
```

Or use `npx` to run the latest version:

```
npx @johnls/octopus --help
```

## Asserters & Assertions

Asserters *assert* machine state and if not in that state *actualize* it.  An asserter name is a noun + verb, e.g. `directoryExists`, `fileUnzipped`, etc.

An assertion is the invocation of an asserter with specific arguments.

