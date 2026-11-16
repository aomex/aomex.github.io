---
outline: deep
---

# rule.hash()

Validates **hex hash string shape** (fixed length per algorithm): `contentMd5`, `etag`, `sha256` fingerprints (format only—not computing the hash).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const callbackSchema = schema({
  contentMd5: rule.hash('md5').required(), // [!code highlight]
});
// 'd41d8cd98f00b204e9800998ecf8427e' → pass
```

- Infers as `string` after validation.
- Algorithm is chosen only at the factory: `md5` / `sha1` / `sha256` / `sha512`, etc.; `0x` prefixes or Base64 usually fail.

Pick the algorithm with the factory argument, e.g. `rule.hash('sha256')`; unknown algorithms follow type hints and runtime errors.

For shared chains see [Common chains](../chain); similar shapes: [string](./string), [buffer](./buffer), [file](./file).