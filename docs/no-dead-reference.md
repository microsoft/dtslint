# no-dead-reference

A `<reference>` comment should go at the top of a file -- otherwise it is just a normal comment.

**Bad**:

```ts
console.log("Hello world!");
/// <reference types="jquery" />
```

**Good**:

```ts
/// <reference types="jquery" />
console.log("Hello world!");
```
