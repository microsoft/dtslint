# prefer-declare-function

Prefer to declare a function using the `function` keyword instead of a variable of function type.

**Bad**:

```ts
export const f: () => number;
```

**Good**:

```ts
export function f(): number;
```
