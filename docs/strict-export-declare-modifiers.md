# strict-export-declare-modifiers

Avoid adding the `declare` keyword unnecessarily.
Do add the `export` keyword unnecessarily, because sometimes it is necessary and we want to be consistent.

**Bad**:

```ts
export declare function f(): void;
declare function g(): void;
interface I {}
```


**Good**:

```ts
export function f(): void;
export function g(): void;
export interface I {}
```
