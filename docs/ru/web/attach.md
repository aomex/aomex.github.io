---
outline: deep
---

# Загрузка файлов

Multipart с аватаром или вложениями: в `body()` пометьте файловые поля как [rule.file()](/ru/validators/rules/file); после проверки из ctx.body берёте временный путь и MD5 и до конца запроса переносите (OSS, локально). Без `body()` multipart файлы не разбираются.

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

Клиент шлёт multipart/form-data: name — обычное поле, avatar — file part. Обычно в action сразу копируют/грузят и отвечают; после ответа временные файлы удаляются.

После проверки avatar: filepath, size, mimetype, hash, hashAlgorithm, originalFilename. В бизнесе чаще filepath и hash. `rule.array(rule.file())` → ctx.body.attachments — массив объектов файлов.

::: warning
Если до 201 файл не перенесён/не залит, временный путь может быть недоступен дальше.
:::

## Размер и MIME

`rule.file().maxSize()` / `.mimeTypes()` на поле режут на **этапе валидации**, меньше лишнего IO, чем проверка в action. С приложением `formData` — берётся строже. Меняли только роут — смотрите оба уровня при 413.

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

`rule.file().maxSize('2mb')` — только это поле. С formData.maxFileSize на приложении — **строже из двух**.

Нестабильная сигнатура — откат к MIME:

```typescript
rule.file().mimeTypes('image/svg+xml').fallbackToMimetype(),
```

::: warning
На публичном аватаре не включайте fallbackToMimetype() легко — больше доверия к Content-Type клиента; только контролируемые сети.
:::

## Несколько файлов в одном поле

В HTML одинаковые name могут дать несколько part; `rule.array(rule.file())` собирает массив. `.length({ max: n })` ограничивает число за запрос.

```typescript
body({
  attachments: rule.array(rule.file().maxSize('10mb')).length({ max: 5 }),
});
```

Несколько файловых полей в одном запросе + лимит formData.maxFiles на приложении — снова строже из двух.

## Квоты WebApp.formData

Два уровня: **WebApp.body.formData** — дефолты сайта (размер файла, число part); на роуте `rule.file()` — поле. 413 после смены одного слоя — проверьте приложение и поле.

| Уровень | Как используют |
| --- | --- |
| `WebApp.body.formData` | Глобальные лимиты; для крупных файлов — сначала здесь |
| `body()` + schema | Парсятся только поля из schema |
| `rule.file()` | Бизнес-правила поля (MIME, размер) |

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

Большие файлы — во временный каталог на диске (не целиком в память), удобно стримить в объектное хранилище. Меняли maxSize на роуте — сверить с formData. 413 — оба уровня.

`rule.file()` во вложенном объекте может не совпасть с плоскими именами multipart — сначала согласуйте формат клиента.

::: warning
Нераспознанный token в mimeTypes падает на этапе конфигурации, а не открывает все типы молча.
:::

## Дальше

- [body](/ru/web/body) (allowlist multipart, create и PATCH)
- [rule.file()](/ru/validators/rules/file) (опции поля)
- [Web](/ru/web/) (глобальные квоты body.formData)