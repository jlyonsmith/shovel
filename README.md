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

## Scripts and Asserters

Octopus scripts are made up of a collections of assertions about a machines state.  Assertions are run one at a time, from the top of the script to the bottom.  Each assertion invokes an *asserter* class to assert some particular type of machine state.  There are asserters for files, directories, users, groups, file downsloads, file contents, and so on.

Asserters are the core of Octopus.  They are simple Javascript objects that contain two methods, `assert` and `rectify`. The `assert` method confirms the machine state. If an `assert` returns `false`, then the machine is not in the correct state and the `rectify` method is called to make `assert` succeed.  If `rectify` cannot put the machine in the correct state then it throws an exception and the script ends. If `assert` returns `true` then the script proceeds.

## Writing an Asserter class

Each script assertions runs with a new instance of the specified asserter. `assert` will always be called before `rectify`.

`assert(args)` gets the args from the script.  It must return `true` or `false`.  It must not `throw`.  State can be saved in `this`.
