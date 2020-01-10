# Shovel: An SSH and Node.js based IT automation tool

Shovel is a tool for performing IT automation tasks.  It's written in Javascript using [NodeJS](https://nodejs.org).  Script files are created in [JSON5](https://json5.org/) format and consist of a sequence of assertions that ensure the state of target system.  Scripts are *idempotent* because after one successful run of a subsequent runs of the same script result in no changes to the target.

## Installation

Install the package globally:

```sh
npm install -g @johnls/shovel
shovel --help
```

Or use `npx` to run the latest version:

```sh
npx @johnls/shovel --help
```

## Example

Here is a Shovel script that creates some directories and files on a remote system:

```json5
{
  // Global settings for the script go here
  settings: {
    description: "A basic script",
  },
  // Global variables go here
  vars: {
    testDir1: "shvl-dir-1",
    testFile1: "shvl-file-1",
  },
  // Every script must have a list of assertions
  assertions: [
    {
      description: "Ensure a test directory",
      // Each assertion specifies an asserter
      assert: "DirectoryExists",
      // And arguments
      with: {
        // Arguments can include Javascript
        path: "{var.testDir1}",
      },
    },
    {
      assert: "FileExists",
      with: {
        path: "{path.join(var.testDir1, var.testFile1)}",
      },
    },
  ],
}
```

## Overview

Shovel has the following key features:

- Bootstraps itself on a remote system, installing Node.js and itself as needed
- Cross platform (macOS/Linux) by leveraging NodeJS's inherent cross platform capabilities
- Comes with a wide range of built-in asserters
- Able to set script wide variables and safely use Javascript for calculated values
- Uses an easy-to-read JSON5 script format, allowing multi-line strings and comments

## Design

Not surprisingly, Shovel borrows from the design of [Ansible](https://www.ansible.com/). It uses SSH to avoid having remote agents. Ansible's *plays* are similar to Shovel's *assertions*.

The *design goals* of Shovel are:

- Be written in and use Javascript and Node.js for platform independence
- Bootstrap the remote system with Node.js and Shovel if not present
- Leverage SSH as the remote transport and for agentless scripting
- Use JSON5 instead of YAML as the script format
- Use plain old Javascript as the string template language
- Be fast and very low footprint
- Use idempotency to avoid unnecessary changes to systems
- Have an easy to parse output format
- Be easily extensible

## Local and Remote Hosts

## Scripts

Shovel scripts can have either a `.json5` extension, or if you want to be able to identify the scripts from the command line, a `.shovel` extension is recommended. Shovel scripts are made up of:

1. `settings`
2. `vars`
3. `includes`
4. `assertions`

Scripts are a sequence of assertions executed sequentially. The order of the assertions is important. Later assertions can expect the assertions higher up in the script to have either be true or to have been rectified to be true.  Note that it is fine to write a script where all the assertions are not expected to be true each time the script is run.  For example, you might write a script to stop a service so you can set some configuration files, then start the service again.  The stop/start assertions will always be triggered.  The important thing is that assertions ensure that the script doesn't make changes it doesn't have too.  This is really helpful when restarting a script after an unexpected failure, for example.

### `settings`

Settings are just metadata for the script.  The following metadata is supported:

- `description` used to display a script description

### `includes`

The `includes` section is evaluated second.  Any included script is run before the `vars` and `assertions`.  Include paths are relative to the current script. A script cannot be included more than once.  If you want to do this use a sementic link in the file system so that each include has a unique path.

### `vars`

### `assertions`

Assertions are a collections of assertions about a host state.  Assertions are run one at a time, from the top of the script to bottom.  Each assertion makes a statement about some particular type of the host machine state.  If that state is not true, then the asserter tries to rectify the situation and make that assertion true.  There are asserters for files, directories, users, groups, file downsloads, file contents, and so on.

See the full list of built-in [asserters](doc/Asserters.md) in the documentation directory.

## SSH

Shovel uses SSH to run scripts on remote hosts. When run against one or more hosts, Shovel uses SSH to run scripts on those hostes. When run without a remote host, Shovel just runs the script directly on your local system.

## Advanced

### JSON5 Nodes

Shovel uses an enhanced fork of the [JSON5](https://www.npmjs.com/package/@johnls/json5) library that returns `Node` objects instead of simple Javascript values for each value, array or object in the JSON5. A node object has `type` and `value` fields, plus `line` and `column` fields showing where in the JSON5 file the node comes from.  This allows error messages that contain location information to help the Shovel user to find and fix errors in their script.

### Writing an Asserter

The asserter must be a Javascript class.  The `constructor` will be called with a `container` object, which at a minimum contains:

Each script assertions runs with a new instance of the specified asserter. `assert` will always be called. `rectify` will only be called if the assertion condition has not been met.

```js
{
  // Expand a string by treating it as a Javascript template and running it in a VM
  interpolator: (string) => {...},
  // The assertion node in the JSON5
  assertNode: {...},
}
```

The `constructor` should:

1. Save desired `container` object references to `this`.
2. Grab any global modules that are needed by the asserter if they are not passed in in the `container`.  In this way mock modules can be injected for testing. See existing asserters for examples of making asserters testable.
3. Do any required setup for the asserter (not common)

The goals for the `assert` method are:

1. Ensure the asserter can run on the current platform given by `this.util.osInfo()`. Throw `ScriptError` on the `assertNode` if not.
2. Validate the passed in `assertNode` in the `assertNode.value.with` node.  Throw a `ScriptError` if the arguments are invalid passing the error message and the node causing the error.
3. Call `this.interpolator()` on any `with` arguments that can be expanded.
4. Cache any values that may be needed by `rectify` in `this`, including the passed in `assertNode`.
5. Check to see if the asserted condition is already met. If it *cannot be met* for whatever reason, throw a `ScriptError` on the `assertNode`.  If the condition has already been met, return `true`.
6. Return `false` if the assertion condition can be met but has not been yet.

The method `rectify()` is called to modify the host state:

1. Make it so the condition that `assert` checks for will succeed next time.
2. Throw a `ScriptError` on `this.assertNode` if the condition cannot be satisfied.
3. Make use of any values cached in `this` from the `assert` method.

Finally, the `result()` method will *always* be called to output the result of the asserter, with a `rectified` flag:

1. Return an object with information that helps the user understand what the assert checked or modified.
2. Do not `throw` from this method

Asserter class naming should generally follow these conventions:

- The name should be a noun and a verb
- Use a noun that describes the thing being asserted on as closely as possible, e.g. File, ZipFile, Package, etc..
- Where the asserter does a from/to operation, the noun should be be the from item, e.g. from a URL to a file.
- The verb should describe the desired state of the thing being asserted in the present tense, e.g. Running, Deleted, Exists, Made, etc..
- Use a verb that is commonly associated with the noun, e.g. running for services, unzipped for zip files, etc..
- The naming should hint at what the asserter does internally as an aid to helping people find the right asserter for a given situation.

Asserter argument naming should generally follow these conventions:

- The argument should include a noun for the thing it pertains too, e.g. `user`, `directory`, `file`, `group`, etc..
- If there are multiple arguments with the same noun, add a pronoun to differentiate, e.g. `fromFile` and `toFile`
