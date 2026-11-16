---
outline: deep
---

# Validator list

Not sure which `rule.xxx()` to use? Start here **by task**, then open the dedicated page for factory-specific methods (`trim`, `min`, `mimeTypes`, …). Almost every factory supports [Common chains](./chain) (`optional`, `default`, `transform`, …).

```typescript
import { rule, schema } from '@aomex/common';

export const task = schema({
  email: rule.email(),
  page: rule.int().min(1).default(1),
  avatar: rule.file(), // Web uploads: @aomex/web
});
```

Three fields cover most days: **identifier**, **pagination integer**, **file**—map the rest with the task table below.

- Each `rule.xxx()` factory infers a different chain type; which methods and chains apply—follow editor completions.
- `rule.file()` registers in `@aomex/web` projects; pure Console Node entry usually has no file rule.
- Combinators (`oneOf`, `array`, …) infer nested or union types—see [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of).
- No factory fits? Use [Custom validators](/en/advanced/validator); do not paper over APIs with `rule.any()`.

Pagination often uses `default(1)`; PATCH uses `optional` / [partial](./schema)—chain options in [Common chains](./chain).

## Find a factory by task

| You need… | Start here |
| --- | --- |
| Username, notes, search terms | [`rule.string()`](./rules/string) |
| Pagination, quantity, auto-increment id | [`rule.int()`](./rules/int) |
| Money, ratios (decimals) | [`rule.decimal()`](./rules/decimal) or [`rule.number()`](./rules/number) |
| Toggles, agreement flags | [`rule.boolean()`](./rules/boolean) |
| Signup email, login account | [`rule.email()`](./rules/email) |
| Callback URL, redirect links | [`rule.url()`](./rules/url) |
| Resource id (UUID / ULID) | [`rule.uuid()`](./rules/uuid) · [`rule.ulid()`](./rules/ulid) |
| Effective time, booking slots | [`rule.date()`](./rules/date) |
| Fixed enums (role, status) | [`rule.enum()`](./rules/enum) · [`rule.literal()`](./rules/literal) |
| Nested JSON objects | [`rule.object()`](./rules/object) or field literals |
| Tag lists, batch ids | [`rule.array()`](./rules/array) |
| Dynamic-key config bags | [`rule.record()`](./rules/record) |
| Payment methods / webhook shapes | [`rule.oneOf()`](./rules/one-of) · [`rule.anyOf()`](./rules/any-of) |
| Avatar, multipart attachments | [`rule.file()`](./rules/file) + [File uploads](/en/web/attach) |
| Big integers, hashes, IP | [`rule.bigint()`](./rules/bigint) · [`rule.hash()`](./rules/hash) · [`rule.ip()`](./rules/ip) |
| Buffer / stream fields | [`rule.buffer()`](./rules/buffer) · [`rule.stream()`](./rules/stream) |
| Truly unconstrained (transitional) | [`rule.any()`](./rules/any) (do not leave on public APIs) |

### Index: factory groups (reference)

**Text and numbers:** [string](./rules/string) · [number](./rules/number) · [int](./rules/int) · [bigint](./rules/bigint) · [decimal](./rules/decimal) · [boolean](./rules/boolean)

**Time and identifiers:** [date](./rules/date) · [email](./rules/email) · [url](./rules/url) · [uuid](./rules/uuid) · [ulid](./rules/ulid) · [ip](./rules/ip) · [hash](./rules/hash)

**Enums and literals:** [enum](./rules/enum) · [literal](./rules/literal)

**Structure:** [object](./rules/object) · [record](./rules/record) · [array](./rules/array) · [buffer](./rules/buffer) · [stream](./rules/stream)

**Combinators:** [oneOf](./rules/one-of) · [anyOf](./rules/any-of) · [allOf](./rules/all-of) · [any](./rules/any)

**Web:** [file](./rules/file)

Do not fake email with `string().match`—[email](./rules/email) is simpler and better for OpenAPI. Public resource ids should use [uuid](./rules/uuid), not bare `string()`. Money and balances need [decimal](./rules/decimal), not raw [number](./rules/number).

::: warning
An endpoint full of `rule.any()` is for temporary integration only—replace with concrete shapes quickly.
:::

## Next steps

- [Common chains](./chain)
- [schema](./schema)
- [Overview](/en/validators/) (first-time setup)