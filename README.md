# Octopus: Simple, agentless IT automation

Octopus is a system for performing IT automation.  It's written in and makes use of Javascript and Node.js.  Script files are created in [JSON5](https://json5.org/) format that consist of a sequence of idempotent assertions ensure the state of target system.  Script idempotency means that after one run of a script to set things into a desired state, subsequent runs of the same script result in no changes to the target.

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

## Assertions

Assertions *assert* machine state, i.e. whether it is true or false that the machine is in certain state. If true, then nothing then nothing needs to be done, and we move on to the next assertion.  If it is false, then the state is *actualized*, i.e. the machine state is made to be such that the assertion will succeed next time.

Assertions make use of *asserters* that perform the assertion and actualization. An asserter is a Javascript object that performs the needed checks and actions.  In the script it is referred to by name.  That name is a noun + verb, e.g. `directoryExists`, `fileUnzipped`, etc.

