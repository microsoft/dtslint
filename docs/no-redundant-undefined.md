# no-redundant-undefined

Avoid explicitly specifying `undefined` as a type for a parameter or property which is already optional.

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
    s?: string | undefined;
}
```

**Good**:

```ts
interface I {
    s?: string;
}
```
