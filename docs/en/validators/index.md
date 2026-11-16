---
outline: deep
---

# Validators

Turn messy external data into something you trust at runtime: block bad input and let TypeScript narrow types. Web `body()` / `query()`, Console `options()`, and OpenAPI often **share the same `rule`s**—no duplicate interfaces.

```typescript
import { rule, validate, schema, type Validator } from '@aomex/common';
```

```typescript
import { rule, validate } from '@aomex/common';

const input = { name: '  Ada  ', age: '18', hack: true };

const user = await validate(input, { // [!code highlight]
  name: rule.string().trim().length({ min: 1, max: 32 }),
  age: rule.int().min(0).optional(),
});

await doSomething(user);
```

Hover `user`:

- `name` → `string` (trimmed)
- `age` → `number | undefined` (`'18'` usually becomes a number; optional)
- no `hack`—undeclared keys are dropped by default

On routes, after `body({ ... })`, `ctx.body` is already narrowed—no manual `validate`.

::: tip
Avoid maintaining Zod plus hand-written interfaces—they drift when fields change. One `rule` definition covers runtime and types.
:::

## Picking a tool

| Goal | Use |
| --- | --- |
| Single field | `rule.string()` / `rule.int()` … → [Validator list](./builtins) |
| Reusable field sets / PATCH derivations | [`schema`](./schema) in `src/schemas/xxx.schema.ts` |
| One-off check in a script or test | [Manual validation](./validate) |
| Nesting, arrays, alternates | [object](./rules/object) / [array](./rules/array) / [oneOf](./rules/one-of) |
| Presence / defaults / doc notes | [Common chains](./chain) |

For arbitrary keys, use [rule.record()](./rules/record) explicitly—do not expect undeclared fields to survive.

::: warning
`rule.any()` works, but types and OpenAPI get vague—OK for transition, avoid on public APIs.
:::

## In this section

| Page | When to open it |
| --- | --- |
| [Validator list](./builtins) | Find a specific `rule.xxx` |
| [Common chains](./chain) | `optional` / `default` / `transform`… |
| [schema](./schema) | pick / omit / partial |
| [Prisma](/en/plugins/prisma) | validation from table schema |
| [Manual validation](./validate) | call `validate` in scripts / tests |
| [Custom validators](/en/advanced/validator) | when builtins are not enough (advanced) |