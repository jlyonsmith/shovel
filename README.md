# Octopus: Simple, agentless IT automation

Octopus is a system for performing IT automation.  It's written in and makes use of Javascript and Node.js.  Script files are created in [JSON5](https://json5.org/) format that consist of a sequence of idempotent command invocations or *actions* that change the state of the target system.  Script idempotency means that after one run of a script to set things into a desired state, subsequent runs of the same script result in no changes to the target.

Additionally, Octopus:

- Prefers a straightforward mapping of commands to well know Linux command line tools
- Supports the use of Javascript expressions
- Allows performing specific actions using sudo or another user

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

