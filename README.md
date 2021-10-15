`dtslint` tests a TypeScript declaration file for style and correctness.
It will install `typescript` and `tslint` for you, so this is the only tool you need to test a type definition.

Lint rules new to dtslint are documented in the [docs](docs) directory.

# Just looking for ExpectType and ExpectError?

[Use tsd instead](https://github.com/SamVerschueren/tsd).

# Setup

If you are working on DefinitelyTyped, read the [DefinitelyTyped README](https://github.com/DefinitelyTyped/DefinitelyTyped#readme).

If you are writing the library in TypeScript, don't use `dtslint`.
Use [`--declaration`](http://www.typescriptlang.org/docs/handbook/compiler-options.html) to have type definitions generated for you.

If you are a library author, read below.


## Add types for a library (not on DefinitelyTyped)

[`dts-gen`](https://github.com/Microsoft/dts-gen#readme) may help, but is not required.

Create a `types` directory. (Name is arbitrary.)
Add `"types": "types"` to your `package.json`.
Read more on bundling types [here](http://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html).


#### `types/index.d.ts`

Only `index.d.ts` needs to be published to NPM. Other files are just for testing.
Write your type definitions here.
Refer to the [handbook](http://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html) or `dts-gen`'s templates for how to do this.


#### `types/tsconfig.json`

```json5
{
    "compilerOptions": {
        "module": "commonjs",
        "lib": ["es6"],
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictFunctionTypes": true,
        "strictNullChecks": true,
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true,

        // If the library is an external module (uses `export`), this allows your test file to import "mylib" instead of "./index".
        // If the library is global (cannot be imported via `import` or `require`), leave this out.
        "baseUrl": ".",
        "paths": { "mylib": ["."] }
    }
}
```

You may extend `"lib"` to, for example, `["es6", "dom"]` if you need those typings.
You may also have to add `"target": "es6"` if using certain language features.


#### `types/tslint.json`

If you are using the default rules, this is optional.

If present, this will override `dtslint`'s [default](https://github.com/Microsoft/dtslint/blob/master/dtslint.json) settings.
You can specify new lint [rules](https://palantir.github.io/tslint/rules/), or disable some. An example:

```json5
{
    "extends": "dtslint/dtslint.json", // Or "dtslint/dt.json" if on DefinitelyTyped
    "rules": {
        "semicolon": false,
        "indent": [true, "tabs"]
    }
}
```


#### `types/test.ts`

You can have any number of test files you want, with any names. See below on what to put in them.



## Write tests

A test file should be a piece of sample code that tests using the library. Tests are type-checked, but not run.
To assert that an expression is of a given type, use `$ExpectType`.
To assert that an expression causes a compile error, use `$ExpectError`.
(Assertions will be checked by the `expect` lint rule.)

```ts
import { f } from "my-lib"; // f is(n: number) => void

// $ExpectType void
f(1);

// Can also write the assertion on the same line.
f(2); // $ExpectType void

// $ExpectError
f("one");
```


## Specify a TypeScript version

Normally packages will be tested using TypeScript 2.0.
To use a newer version, specify it by including a comment like so:

```ts
// Minimum TypeScript Version: 2.1
```

For DefinitelyTyped packages, this should go just under the header (on line 5).
For bundled typings, this can go on any line (but should be near the top).


## Run tests

- `npm install --save-dev dtslint`
- Add to your `package.json` `scripts`: `"dtslint": "dtslint types"`
- `npm run dtslint`

### Options

- `--localTs`

Use your locally installed version of TypeScript.

```sh
dtslint --localTs node_modules/typescript/lib types
```
- `--expectOnly`

Disable all the lint rules except the one that checks for type correctness.

```sh
dtslint --expectOnly types
```


# Contributing

## Build

```sh
npm link . # Global 'dts-lint' should now refer to this.
npm run watch
```

## Test

Use `npm run test` to run all tests.
To run a single test: `node node_modules/tslint/bin/tslint --rules-dir bin/rules --test test/expect`.

## Publish

1. Change the version in the `package.json`
2. Push to master

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## FAQ
I'm getting an error about a missing typescript install.
```
Error: Cannot find module '/node_modules/dtslint/typescript-installs/3.1/node_modules/typescript`
```
Your dependencies may be out of date.
[@definitelytyped/typescript-versions](https://github.com/microsoft/DefinitelyTyped-tools/tree/master/packages/typescript-versions) is the package that contains the list of TypeScript versions to install.

Alternatively this error can be caused by concurrent dtslint invocations trampling each other's TypeScript installations, especially in the context of continuous integration, if dtslint is installed from scratch in each run.
If for example you use [Lerna](https://github.com/lerna/lerna/tree/main/commands/run#readme), try running dtslint with [`lerna --concurrency 1 run ...`](https://github.com/lerna/lerna/tree/main/core/global-options#--concurrency).
