---
outline: deep
---

# rule.string()

Validates and narrows **human-readable text**: nicknames, titles, search terms, notes.

Shared chains (`optional` / `required` / `nullable` / `default` / `transform` / `docs`, etc.) live in [Common chains](../chain); below covers **rule-specific** methods only.

```typescript
import { rule, schema } from '@aomex/common';

export const nicknameSchema = schema({
  displayName: rule.string().trim().length({ min: 1, max: 32 }), // [!code highlight]
  q: rule.string().trim().optional(),
});
// body: { displayName: '  Ada  ' } → displayName is 'Ada'
```

- After validation the field infers as `string` (`transform` return types follow [Common chains](../chain)).
- Default treats `''` as “missing”; with `optional()`, empty string often becomes `undefined`.
- After `allowEmptyString()`, `''` stays a valid `string`.

### trim(is?: boolean)

**When to use:** forms, paste, IME leading/trailing spaces—without trim, “identical-looking” values miss the DB.

```typescript
import { rule } from '@aomex/common';

rule.string().trim();
rule.string().trim().length({ min: 1, max: 32 });
```

### length(n | { min?, max? })

**When to use:** OTP length, password minimum, note caps (JS string `.length`, UTF-16 code units).

```typescript
import { rule } from '@aomex/common';

rule.string().length(6);
rule.string().length({ min: 8, max: 128 });
```

With `trim`, length is measured **after** trim.

### match(pattern: RegExp)

**When to use:** alphanumeric usernames, invite code formats. Prefer dedicated factories for email / URL / UUID.

```typescript
import { rule } from '@aomex/common';

rule.string().trim().match(/^[a-z][a-z0-9_]{2,31}$/i);
```

Do not approximate email, URL, IP with `match`—dedicated factories give better OpenAPI semantics.

### allowEmptyString()

**When to use:** cleared search still sends `q=`, notes may store explicit empty string, align with controlled `value=""` on the frontend.

```typescript
import { rule } from '@aomex/common';

rule.string().allowEmptyString().default('');
// '' → '' (pass); without this, optional often treats '' as missing
```

When you need `optional()` but `''` is valid, add `allowEmptyString()`—otherwise empty string behaves like absent.

For shared chains see [Common chains](../chain); specialized shapes: [email](./email), [url](./url), [uuid](./uuid), [ip](./ip), [hash](./hash).