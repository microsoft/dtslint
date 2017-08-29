# no-padding

Avoid blank lines before opening tokens or after closing tokens.

**Bad**:

```ts
function f() {

    return [

        g(

            0

        )

    ];

}
```

**Good**:

```ts
function f() {
    return [
        g(
            0
        )
    ];
}
```
