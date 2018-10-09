# dt-header

(This rule is specific to DefinitelyTyped.)

Checks the format of DefinitelyTyped header comments.

---

**Bad**:

```ts
// Type definitions for foo v1.2.3
```

* Don't include `v`
* Don't include a patch version

**Good**:

```ts
// Type definitions for foo 1.2
```

---

**Bad**:

```ts
// Definitions by: My Name <http://geocities.com/myname>
```

**Good**:

```ts
// Definitions by: My Name <https://github.com/myname>
```

* Prefer a GitHub username, not a personal web site.

---

**Bad**:

`foo/index.d.ts`:

```ts
// Type definitions for abs 1.2
// Project: https://github.com/foo/foo
// Definitions by: My Name <https://github.com/myname>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export { f } from "./subModule";
```

`foo/subModule.d.ts`:

```ts
// Type definitions for abs 1.2
// Project: https://github.com/foo/foo
// Definitions by: My Name <https://github.com/myname>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export function f(): number;
```

`foo/ts3.1/index.d.ts`:
```ts
// Type definitions for abs 1.2
// Project: https://github.com/foo/foo
// Definitions by: My Name <https://github.com/myname>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export function f(): number;
```


**Good**:

`foo/index.d.ts`: Same

`foo/subModule.d.ts`:
```ts
export function f(): number;
```

`foo/ts3.1/index.d.ts`:
```ts
export function f(): number;
```

Don't repeat the header -- only do it in the index of the root.
