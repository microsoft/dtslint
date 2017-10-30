# no-outside-dependencies

Don't import from `DefinitelyTyped/node_modules`.

**Bad**:

```ts
import * as x from "x";
// where 'x' is defined only in `DefinitelyTyped/node_modules`
```

**Good**:

Add a `package.json`:

```ts
{
    "private": true,
    "dependencies": {
        "x": "^1.2.3"
    }
}
```
