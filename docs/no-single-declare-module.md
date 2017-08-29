# no-single-declare-module

`declare module` should typically be avoided.
Instead, the file itself should be used as the declaration for the module.
TypeScript uses [module resolution](http://www.typescriptlang.org/docs/handbook/module-resolution.html) to determine what files are associated with what modules.

**Bad**:

```ts
declare module "mylib" {
    function foo(): number;
}
```

**Good**:

```ts
export function foo(): number;
```
