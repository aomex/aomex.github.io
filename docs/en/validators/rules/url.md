---
outline: deep
---

# rule.url()

Validates **URL strings**: avatars, home pages, callbacks, doc links (defaults to `http` / `https`).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only.

```typescript
import { rule, schema } from '@aomex/common';

export const profileSchema = schema({
  avatar: rule.url().optional(), // [!code highlight]
});
// 'https://cdn.example.com/u/1.png' → pass; 'not a url' → fail
```

- Infers as `string` after validation (normalized URL string at runtime—check types if you rely on exact shape).
- `scheme([...])` **replaces** the default protocol list; it does not append.

### scheme(schemes: string[])

**When to use:** production callbacks HTTPS-only; internal mirrors allowing `http`+`https`; rare schemes (`ftp`, etc.) listed explicitly.

```typescript
import { rule } from '@aomex/common';

rule.url().scheme(['https']).required();
rule.url().scheme(['https', 'http']);
```

For shared chains see [Common chains](../chain); see also [email](./email), [string](./string), [ip](./ip).