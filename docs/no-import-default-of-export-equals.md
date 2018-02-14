# no-import-default-of-export-equals

Don't use a default import of a package that uses `export =`.
Users who do not have `--allowSyntheticDefaultExports` or `--esModuleInterop` will get different behavior.
This rule only applies to definition files -- for test files you can use a default import if you prefer.

**Bad**:

```ts
// foo/index.d.ts
declare interface I {}
export = I;

// bar/index.d.ts
import I from "foo";
```

**Good**:

```ts
import I = require("foo");
```
