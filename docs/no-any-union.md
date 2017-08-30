# no-any-union

Forbids to include `any` in a union. When `any` is used in a union type, the resulting type is still `any`.

**Bad**:

```ts
function f(x: string | any): void;
```

**Good**:

```ts
function f(x: string): void;
```

Or:
```ts
function f(x: any): void;
```

Or:
```ts
function f(x: string | object): void;
```

While the `string` portion of this type annotation may _look_ useful, it in fact offers no additional typechecking over simply using `any`.
