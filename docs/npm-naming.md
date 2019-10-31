# npm-naming

(This rule is specific to DefinitelyTyped.)

Checks that the name of the type package matches a source package on npm.

---

**Bad**:

```ts
// Type definitions for browser-only-package 1.2
```

* If the package is really browser-only, you have mark it with "non-npm package"
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

* A commonjs module.exports assignment is not really an export default, and the d.ts should use the `export =` syntax.
* `export default` can only be used to export a commonjs `module.exports =` when you have `esModuleInterop` turned on, which not everybody does.

**Good**:

`foo/index.d.ts`:

```ts
function f(): void;
export = f;
```
