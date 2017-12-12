# no-single-element-tuple-type

Some users mistakenly write `[T]` when then intend to write an array type `T[]`.

**Bad**:

```ts
export const x: [T];
```

**Good**:

```ts
export const x: T[];
```
