---
outline: deep
---

# rule.file()

Validates **multipart uploads** (`@aomex/web`): avatars, ID photos, CSV imports (outputs a formidable file object).

For shared chaining methods see [Common chains](../chain); below covers **rule-specific** APIs only. Upload flow: [File uploads](/en/web/attach).

```typescript
import { rule } from '@aomex/web';

export const avatarField = rule.file().maxSize('2mb').mimeTypes('image/jpeg', 'image/png');
```

Do not use `file` for browser JSON uploads—use multipart and [File uploads](/en/web/attach).

- After validation you get a formidable file object (path, size, mimetype, etc.), not `Buffer`.
- This rule often has **no** `nullable` / `default`—follow this page and type hints.
- When `mimeTypes` and magic bytes disagree, behavior depends on `fallbackToMimetype`.

### maxSize(byte: number | string)

**When to use:** block huge files filling disk; `'20kb'` / `'2mb'` or raw bytes.

```typescript
import { rule } from '@aomex/web';

rule.file().maxSize('2mb');
rule.file().maxSize(500_000);
```

### mimeTypes(...tokens | tokens[])

**When to use:** avatars images-only, imports CSV-only; when signatures exist, content wins.

```typescript
import { rule } from '@aomex/web';

rule.file().mimeTypes('.png', 'image/jpeg');
rule.file().mimeTypes(['image/*']);
rule.file().mimeTypes('.csv', 'text/csv');
```

### fallbackToMimetype(enable?: boolean)

**When to use:** CSV / HTML / plain text without stable magic—default `true` falls back to client `Content-Type` vs `mimeTypes`.

```typescript
import { rule } from '@aomex/web';

rule.file()
  .mimeTypes('.html', 'text/plain', 'text/csv')
  .fallbackToMimetype();
```

Temp files are cleaned after the response—`rename` or upload to object storage promptly in the action.

For shared chains see [Common chains](../chain); see also [buffer](./buffer), [stream](./stream).