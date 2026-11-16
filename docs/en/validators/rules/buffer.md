---
outline: deep
---

# rule.buffer()

Validates **Node.js `Buffer`**: signature hex, ciphertext, raw bytes in queue jobs (not casual JSON `Buffer` fields).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const attestationSchema = schema({
  signature: rule.buffer().parseFrom('base64').required(), // [!code highlight]
});
// 'SGVsbG8=' → Buffer
```

- By default only real `Buffer` instances; JSON strings are not auto-converted without `parseFrom`.
- After `parseFrom('hex', 'base64')` the field still infers as `Buffer`.
- Browser JSON bodies cannot carry `Buffer`—public APIs almost always use strings + `parseFrom`.

### parseFrom(...encodings: 'hex' | 'base64')

**When to use:** REST JSON with hex signatures or base64 image bytes; you can list several encodings for the runtime to try.

```typescript
import { rule } from '@aomex/common';

rule.buffer().parseFrom('base64').required();
rule.buffer().parseFrom('hex', 'base64');
```

To accept hex-looking strings without producing a `Buffer`, use [string](./string) + `match` or fixed-length [hash](./hash).

For shared chains see [Common chains](../chain); see also [file](./file), [hash](./hash), [string](./string).