# redundant-undefined

Avoid explicitly specifying `undefined` as a type for a parameter which is already optional.

**Bad**:

```ts
function f(s?: string | undefined): void {}
```

**Good**:

```ts
function f(s?: string): void {}
```
