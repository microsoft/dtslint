# no-const-enum

Avoid using `const enum`s. These can't be used by JavaScript users or by TypeScript users with [`--isolatedModules`](https://www.typescriptlang.org/docs/handbook/compiler-options.html) enabled.

**Bad**:

```ts
const enum Bit { Off, On }
export function f(b: Bit): void;
```

**Good**:

```ts
export function f(b: 0 | 1): void;
```
