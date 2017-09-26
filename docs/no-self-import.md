# no-self-import

A package should not import components of itself using a globally-qualified name; it should use relative imports instead.

**Bad**:

```ts
import foo from "this-package/foo.d.ts";
```

**Good**:

```ts
import foo from "./foo.d.ts";
```

**Bad**:

```ts
import myself from "this-package";
```

**Good**:

```ts
import myself from ".";
```
