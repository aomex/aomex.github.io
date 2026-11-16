---
outline: deep
---

# rule.email()

Validates **email-shaped strings**: registration, notification recipients, invites (format only—not mailbox existence).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const registerSchema = schema({
  email: rule.email().required(), // [!code highlight]
});
// { email: 'ada@example.com' } → pass; 'ada@' → fail
```

- Infers as `string`; OpenAPI often marks `format: email`.
- No dedicated trim/length chain—handle via [Common chains](../chain) `transform` or in the action.

Use this factory for any “must be email” field; do not fake it with `string().match`. Login “email or employee id” fits [anyOf](./any-of).

### match(pattern: RegExp)

**When to use:** corporate signup domain-only, beta allowlist suffixes (after base email format passes).

```typescript
import { rule } from '@aomex/common';

rule.email().match(/@acme\.com$/i);
// 'ada@acme.com' → pass; 'ada@gmail.com' → format ok, match fails
```

`match` adds format constraints only—it does not replace “verification email sent” logic in your app.

For shared chains see [Common chains](../chain); see also [string](./string), [url](./url), [anyOf](./any-of).