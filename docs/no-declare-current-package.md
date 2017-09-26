# no-declare-current-package

Avoid using `declare module`, and prefer to declare module contents in a file.

**Bad**:

```ts
// foo/index.d.ts
declare module "foo" {
    export const x = 0;
}
```

**Good**:

```ts
// foo/index.d.ts
export const x = 0;
```

**Bad**:

```ts
// foo/index.d.ts
declare module "foo/bar" {
    export const x = 0;
}
```

**Good**:

```ts
// foo/bar.d.ts
export const x = 0;
```
