# no-bad-reference

(This rule is specific to DefinitelyTyped.)
Avoid using `<reference path>`.

**Bad**:

```ts
/// <reference path="../node_modules/@types/foo/index.d.ts" />
import * as foo from "foo";
```

**Good**:

If "foo" is written in external module style (see `no-single-declare-module`), the import alone should work thanks to [module resolution](http://www.typescriptlang.org/docs/handbook/module-resolution.html):

```ts
// TypeScript will look for a definition for "foo" using module resolution
import * as foo from "foo";
```

If not, use `<reference types>` instead:

```ts
/// <reference types="foo" />
```

The only time `<reference path>` should be necessary if for global (not module) libraries that are separated into multiple files; the index file must include references to the others to bring them into the compilation.
