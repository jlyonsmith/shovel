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

## Features

Octopus has the following features:

- Able to set script wide variables
- Can safely use Javascripts templated string functionality in scripts
- Cross platform (macOS, Linux, Windows) by leveraging Node's inherent cross platform capabilities
- An easy to read JSON5 format script format that allows multi-line strings and comments

## Scripts and Asserters

Octopus scripts are made up of a collections of assertions about a host state.  Assertions are run one at a time, from the top to bottom.  Each assertion invokes an *asserter* class to assert some particular type of machine state.  There are asserters for files, directories, users, groups, file downsloads, file contents, and so on.

Asserters are the core of Octopus.  They are simple Javascript objects that contain two methods, `assert` and `rectify`. The `assert` method confirms the machine state. If `assert` returns `true` then the script proceeds. If `assert` returns `false`, then the machine is not in the correct state and the `rectify` method is called to fix things. If `rectify` cannot put the machine in the correct state so that `assert` will succeed next time then it throws an exception and the script ends.  The `assert` will throw an exception if it is impossible for the `assert` to ever succeed, e.g. unzipping a file that is not actually present.

## Writing an Asserter Class

Each script assertions runs with a new instance of the specified asserter. `assert` will always be called before `rectify`.

The assertert must be a Javascript ES6 class.  The `constructor` will be called with a container object as follows:

```js
{
  newScriptError: (message, node) => {...}, // Create a new script error for the given node
  expandStringNode: (string) => {...} // Expand a string by treating it as a Javascript template and running it in a VM
  withNode: {...} // The parent 'with' node of the assertion
}
```

The method `assert(args)` receives the args from the script and must return `true` or `false`.  It can throw if the assert can never succeed. State can be saved in `this` in the `assert` call to be used by `rectify` if `assert` returns `false`.  You must save the `args` parameter if you want to use it in `rectify`.  Note that the `args` argument is a tree of JSON5 node objects as described in this [JSON5](https://www.npmjs.com/package/@johnls/json5) fork. A node is a Javascript object that was generated from JSON5 with a `type` and `value` fields, plus `line` and `column` fields showing where in the JSON5 file the object was created from.  This allows outputting error messages that enable the Octopus user to find and fix errors in their script.

The method `rectify()` is called to modify the host state.  The key thing is that when `rectify` finishes the next call to `assert` *must succeed*.  If rectify cannot ensure this, then it should throw a `ScriptError` (see `newScriptError` above) or some other `Error` with enough information for the user to be able to fix the problem.

Finally, the `result()` method will always be called to output the result of the asserter.  This method should contain an object that helps the user understand what the assert checked or modified.

## Background

Octopus steals heavily from the design of [Ansible](https://www.ansible.com/). Specifically the reliance on SSH.  Also Ansible's *idempotent* plays are similar to Octopuses asserters.  The goal of Octopus are:

- Be written in and use Javascript and Node.js
- Use Javascript for templated strings to keep the learning curve low
- Use JSON instead of YAML as a script format
- Be fast!
- Leverage SSH as a remote transport
- Have asserters use idempotency consistently (no empty assertions)
- Have an easy to parse output format
- Leverage Node.js for platform independence whenever possible
