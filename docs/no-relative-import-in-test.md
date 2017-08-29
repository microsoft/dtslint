# no-relative-import-in-test

A test file should not contain relative imports; it should use a global import of the library using [module resolution](http://www.typescriptlang.org/docs/handbook/module-resolution.html).

**Bad**:

```ts
import foo from "./index.d.ts";
```

**Good**:

```ts
import foo from "foo";
```
