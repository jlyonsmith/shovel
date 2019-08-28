# Octopus: Simple, agentless IT automation

Octopus is a system for performing IT automation.  It's written in Javascript using Node.js.  Script files are created in [JSON5](https://json5.org/) format and consist of a sequence of *idempotent* assertions that ensure the state of target system.  Script idempotency means that after one run of a script to set things into a desired state, subsequent runs of the same script result in *no changes to the target*.

## Installation

Install the package globally:

```sh
npm install -g @johnls/octopus
octopus --help
```

Or use `npx` to run the latest version:

```sh
npx @johnls/octopus --help
```

## Example

Here is a valid Octopus script that creates some directories and files on a remote system:

```json5
{
  // Global options for the script go here
  options: {
    description: "A basic script",
  },
  // Global variables go here
  vars: {
    TEST_DIR_1: "octo-dir-1",
    TEST_DIR_2: "octo-dir-2",
    TEST_FILE_1: "octo-file-1",
  },
  // Every script must have a list of assertions
  assertions: [
    {
      description: "Create Test Directory",
      // Each assertion specifies an asserter...
      assert: "DirectoryExists",
      // And arguments
      with: {
        // Arguments can include template substitutions, exactly like Javascript
        path: "scratch/${TEST_DIR_1}",
      },
    },
    {
      description: "Create A Second Directory",
      assert: "DirectoryExists",
      with: {
        path: "scratch/${TEST_DIR_2}",
      },
    },
    {
      assert: "FileExists",
      with: {
        path: "scratch/${TEST_FILE_1}",
      },
    },
  ],
}
```

## Overview

Octopus has the following features:

- Bootstraps itself on a remote system, installing Node.js and Octopus as needed
- Able to set script wide variables
- Can safely use Javascripts templated string functionality in scripts
- Cross platform (macOS, Linux, Windows) by leveraging Node's inherent cross platform capabilities
- An easy to read JSON5 format script format that allows multi-line strings and comments

### Design

Octopus borrows heavily from the design of [Ansible](https://www.ansible.com/). For example, the use of SSH to avoid having remote agents.  Also Ansible's idempotent *plays* are similar to Octopuses *asserters*.

The *design goals* of Octopus are:

- Be written in and use Javascript and Node.js
- Use Javascript for templated strings to keep the learning curve low
- Use JSON instead of YAML as a script format
- Be fast
- Must bootstrap the remote system with Node.js
- Must bootstrap the remote system with Octopus
- Leverage SSH as a remote transport
- Have asserters use idempotency consistently (no empty assertions)
- Have an easy to parse output format
- Whenever possible leverage Node.js for platform independence

### Scripts and Asserters

Octopus scripts are made up of a collections of assertions about a host state.  Assertions are run one at a time, from the top to bottom.  Each assertion invokes an *asserter* class to assert some particular type of machine state.  There are asserters for files, directories, users, groups, file downsloads, file contents, and so on.

Asserters are the core of Octopus.  They are simple Javascript objects that contain two methods, `assert` and `rectify`. The `assert` method confirms the machine state. If `assert` returns `true` then the script proceeds. If `assert` returns `false`, then the machine is not in the correct state and the `rectify` method is called to fix things. If `rectify` cannot put the machine in the correct state so that `assert` will succeed next time then it throws an exception and the script ends.  The `assert` will throw an exception if it is impossible for the `assert` to ever succeed, e.g. unzipping a file that is not actually present.

### SSH Authentication

When run against one or more hosts, Octopus uses SSH to run scripts on those hostes. When run without a remote host, Octopus just runs the script directly.

## Asserters

### `FileAbsent`

Ensures that a file is absent (deleted) from a system.

| Arg    | Type     | Description                       |
| ------ | -------- | --------------------------------- |
| `path` | `String` | Path of the file to ensure absent |

// TODO: Document all asserters

## Advanced

### Writing an Asserter Class

Each script assertions runs with a new instance of the specified asserter. `assert` will always be called before `rectify`.

The assertert must be a Javascript ES6 class.  The `constructor` will be called with a container object as follows:

```js
{
  // Expand a string by treating it as a Javascript template and running it in a VM
  expandStringNode: (string) => {...},
  // The assertion node in the JSON5
  assertNode: {...},
}
```

The method `assert(assertNode)` receives an assert *node object* (see below) and must return `true` or `false`.  `true` is returned if the system state matches the assertion, `false` otherwise. `assert` should throw if it is going to return `false` and the `rectify` call could never succeed, e.g. the user needs to be root to rectify something or a situation exists which blocks rectifying the situation. Save anything to `this` that you calculate or need from the `assertNode` in the `assert` call so that it can be used by `rectify`.

A node object is a Javascript object that was generated from JSON5 with a `type` and `value` fields, plus `line` and `column` fields showing where in the JSON5 file the object was created from.  This allows outputting error messages that enable the Octopus user to find and fix errors in their script. See the [JSON5](https://www.npmjs.com/package/@johnls/json5) fork for more details.

The method `rectify()` is called to modify the host state.  The key thing is that when `rectify` finishes the next call to `assert` *must succeed*.  If rectify cannot ensure this, then it should throw a new `ScriptError` or some other `Error` with enough information for the user to be able to fix the problem.

Finally, the `result()` method will always be called to output the result of the asserter.  This method should contain an object that helps the user understand what the assert checked or modified.

## Test Plan

```sh
octopus --help
```

```sh
octopus --version
```

```sh
octopus example/bad-assertion.json5
```

```sh
octopus example/basic.json5
```
