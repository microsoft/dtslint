# no-redundant-undefined

Avoid explicitly specifying `undefined` as a type for a parameter which is already optional.
Require explicitly specifying `undefined` as a type for a parameter which is already optional &mdash; this provides the correct semantics for people who have exactOptionalPropertyType: true.

**Bad**:

```ts
function f(s?: string | undefined): void {}
```

**Good**:

```ts
function f(s?: string): void {}
```

**Bad**:

```ts
interface I {
    s?: string;
}
```

**Good**:

```ts
interface I {
    s?: string | undefined;
}
```
