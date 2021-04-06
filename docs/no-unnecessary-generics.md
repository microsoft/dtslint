# no-unnecessary-generics

Forbids a function to use a generic type parameter only once.
Generic type parameters allow you to relate the type of one thing to another;
if they are used only once, they can be replaced with their type constraint.

**Bad**:

```ts
function logAnything<T>(x: T): void;
```

**Good**:

```ts
function logAnything(x: any): void;
```

---

**Bad**:

```ts
function useLogger<T extends Logger>(logger: T): void;
```

**Good**:

```ts
function useLogger(logger: Logger): void;
```

---

**Bad**:

```ts
function clear<T>(array: T[]): void;
```

**Good**:

```ts
function clear(array: any[]): void;
```

---

`getMeAT<T>(): T`:
If a type parameter does not appear in the types of any parameters, you don't really have a generic function, you just have a disguised type assertion.
Prefer to use a real type assertion, e.g. `getMeAT() as number`.
Example where a type parameter is acceptable: `function id<T>(value: T): T;`.
Example where it is not acceptable: `function parseJson<T>(json: string): T;`.
Exception: `new Map<string, number>()` is OK.

**Bad**:

```ts
function parse<T>(): T;
const x = parse<number>();
```

**Good**:


```ts
function parse(): {};
const x = parse() as number;
```
