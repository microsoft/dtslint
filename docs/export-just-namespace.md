# export-just-namespace

Declaring a namespace is unnecessary if that is the module's only content; just use ES6 export syntax instead.

**Bad**:

```ts
namespace MyLib {
    export function f(): number;
}
export = MyLib;
```

**Good**:

```ts
export function f(): number;
```

**Also good**:

```ts
namespace MyLib {
    export function f(): number;
}
function MyLib(): number;
export = MyLib;
```

