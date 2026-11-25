---
outline: deep
---

# File uploads

Build multipart routes with avatars or attachments: mark file fields with [rule.file()](/en/validators/rules/file) in `body()`; after validation read temp path and MD5 from `ctx.body` and move them before the request ends (OSS, local disk, etc.). Multipart without `body()` is not parsed for files.

```typescript
import { rule } from '@aomex/common';
import { body, Router } from '@aomex/web';

export const router = new Router();

router.post('/users', { // [!code focus:13]
  mount: [
    body({ // [!code highlight]
      name: rule.string(),
      avatar: rule.file(),
    }),
  ],
  action: async (ctx) => {
    const { name, avatar } = ctx.body;
    await saveAvatarToOss(avatar.filepath, avatar.hash);
    ctx.send(201, { name, hash: avatar.hash });
  },
});
```

Client uses `multipart/form-data`: `name` as a normal field, `avatar` as a file part. Typical pattern: upload or copy in the action before responding—temp files are cleaned after the response.

After validation `avatar` roughly has `filepath`, `size`, `mimetype`, `hash`, `hashAlgorithm`, `originalFilename`; business code usually needs `filepath` and `hash`. With `rule.array(rule.file())`, `ctx.body.attachments` is an array of file objects.

::: warning
If you return 201 before move/upload finishes, the temp path may not be readable on the next request.
:::

## Size and MIME

Per-field `rule.file().maxSize()` / `.mimeTypes()` block bad uploads at **validation**—less IO than checking in the action. With app-level `formData`, the **stricter** limit wins; on **413** check both layers.

```typescript
body({
  avatar: rule.file().maxSize('2mb'),
});
```

```typescript
body({
  avatar: rule.file().mimeTypes('.png', 'image/*'),
});
```

`rule.file().maxSize('2mb')` only narrows that field; with app `formData`, **stricter wins**.

When magic bytes are unreliable, fall back to MIME:

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
Public avatars should rarely use `fallbackToMimetype()`—it trusts client `Content-Type`; OK for controlled internal networks.
:::

## Multiple files, one field

HTML can send multiple parts with the same name—`rule.array(rule.file())` collects an array. Use `.length({ max: n })` to cap count per request.

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

Multiple file fields also hit app `formData.maxFiles`—stricter of route and app quotas applies.

## WebApp.formData quotas

Parsing is two layers: **WebApp.body.formData** sets site defaults (per-file size, total parts); route `rule.file()` tightens individual fields. On **413**, check whether app or field rules triggered.

| Layer | Typical use |
| --- | --- |
| `WebApp.body.formData` | Site-wide caps—large-file sites tune here first |
| `body()` + schema | Only declared fields are parsed |
| `rule.file()` | Per-field rules (MIME, size) |

```typescript
import { logger } from '@/services/logger.service';

new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:3]
    formData: { maxFileSize: '20mb', maxFiles: 10 }, // [!code highlight]
  },
  mount: [routers('./src/routers')],
});
```

Large files land on disk temp paths—not whole in memory—so you can stream to object storage. When only route `maxSize` changes, compare app `formData`; check both on **413**.

Nested objects with `rule.file()` often mismatch flat multipart field names—align with how the client sends parts.

::: warning
Unrecognized tokens in `mimeTypes` fail at configuration time instead of silently allowing all types.
:::

## Next steps

- [Request body](/en/web/body) (multipart allowlist, create and PATCH)
- [rule.file()](/en/validators/rules/file) (field-specific options)
- [Web app entry](/en/web/) (global `body.formData` quotas)