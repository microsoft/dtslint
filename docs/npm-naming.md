# npm-naming

(This rule is specific to DefinitelyTyped.)

## Name checks
In 'name-only' mode, checks that the name of the type package matches a source package on npm.

---

**Bad**:

```ts
// Type definitions for browser-only-package 1.2
```

* If the package is really browser-only, you have to mark it with "non-npm package".
* If the package actually has a matching npm package, you must use that name.

**Good**:

```ts
// Type definitions for non-npm package browser-only-package 1.2
```

---

**Bad**:

```ts
// Type definitions for some-package 101.1
```

* The version number in the header must actually exist on npm for the source package.

**Good**:

```ts
// Type definitions for some-package 10.1
```

## Code checks

In 'code' mode, in addition to the name checks, this rule also checks that the source JavaScript code matches the declaration file for npm packages.

---

**Bad**:

`foo/index.d.ts`:

```ts
declare function f(): void;
export default f;
```

`foo/index.js`:

```js
module.exports = function () {
};
```

* A CommonJs module.exports assignment is not really an export default, and the d.ts should use the [`export =`](https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require) syntax.
* `export default` can only be used to export a CommonJs `module.exports =` when you have `esModuleInterop` turned on, which not everybody does.

**Good**:

`foo/index.d.ts`:

```ts
declare function f(): void;
export = f;
```

---

**Bad**:

`foo/index.d.ts`:

```ts
export class C {}
```

`foo/index.js`:

```js
module.exports = class C {}
```

* The CommonJs module is a class, which means it can be constructed, like this:
```js
var C = require('foo');
var x = new C();
```
However, the way `class C` is exported in the d.ts file (using an export declaration) means it can only be used like this:
```ts
var foo = require('foo');
var x = new foo.C(); 
```

* The d.ts should use [`export =`](https://www.typescriptlang.org/docs/handbook/modules.html#export--and-import--require)
syntax to match the CommonJs module behavior.

**Good**:

`foo/index.d.ts`:

```ts
declare class C {}
export = C;
```

* If you need to use `export =` syntax as in the example above, and the source JavaScript also exports some properties,
you might need to use [*declaration merging*](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-namespaces-with-classes-functions-and-enums) in your d.ts. Example:

**JavaScript**:

`foo/index.js`:

```js
function foo() {};
foo.bar = "Exported property";
module.exports = foo; // module.exports is a function, but it also has a property called `bar`
```

**Declaration**:

`foo/index.d.ts`:

```ts
declare function foo(): void;
declare namespace foo {
    var bar: string;
}
export = foo;
```
