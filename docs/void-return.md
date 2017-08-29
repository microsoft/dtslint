# void-return

`void` should be used as a return type, but not as a parameter type.

**Bad**:

```ts
export function f(x: string | void): undefined;
```

**Good**:

```ts
export function f(x: string | undefined): void;
```
