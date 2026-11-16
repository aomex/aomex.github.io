---
outline: deep
---

# rule.ip()

Validates **IP literals**: allowlist `clientIp`, VPN peers, resolver addresses (pick `v4` / `v6` at the factory).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const allowlistSchema = schema({
  peer: rule.ip('v4').required(), // [!code highlight]
});
// '203.0.113.10' → pass; '2001:db8::1' with v4-only → fail
```

- Infers as `string` after validation.
- **Version only at the factory** `rule.ip('v4' | 'v6' | [...])`; there is no `.v6()` chain helper.

### match(pattern: RegExp)

**When to use:** after the value is a valid IP, block obvious non-public ranges (complex CIDR belongs in the action with a dedicated library).

```typescript
import { rule } from '@aomex/common';

rule.ip('v4').match(/^10\./);
// '10.0.0.1' → pass; '203.0.113.1' → fail
```

For shared chains see [Common chains](../chain); see also [string](./string), [url](./url), [hash](./hash).