---
outline: deep
---

# ETag

Считает entity tag для успешных GET/HEAD. Если клиент прислал If-None-Match и тело не изменилось — **304**, экономия трафика. Подходит для полустатичной конфигурации и версии; сильно персонализированные списки выигрывают мало.

```bash
pnpm add @aomex/etag
```

## На весь WebApp

Повесьте `etag()` в `WebApp.mount`: успешные GET/HEAD получат ETag; при совпадении If-None-Match без изменений — 304. Бизнес-логика по-прежнему `ctx.send`.

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

В action — ctx.send(data); при совпадении и «свежести» middleware отдаёт 304 с пустым body.

Обычный WebMiddleware, в ctx новых полей нет. Со стороны эффекта: первый ответ с ETag; повтор с If-None-Match при совпадении → **304**. Уже есть заголовок Etag, не 2xx или не GET/HEAD — обычно не переписывается.

::: tip
Если на всём сайте включён [envelope](/ru/web/envelope), оболочка переписывает body и снаружи делает 200; фреймворк **снимает исходный ETag**, чтобы digest не относился к телу до envelope. Для условного кэша убедитесь, что digest считается после envelope, или `skipEnvelope` на этом выходе.
:::

## Полустатичные API

Публичный конфиг, версия — «почти не меняется» — достаточно глобального etag(); в action как обычно читаете БД и `send`:

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

Динамический JSON, где семантика та же — включите слабую проверку: `etag({ weak: true })` (по умолчанию строгая; `ReadStream` часто weak). Для «заказы пользователя» глобальный жёсткий ETag не обязателен.

## Статика + сжатие

Статика и compress рядом — ETag обычно **перед** ними, чтобы digest видел содержимое до финальной записи (проверяйте по реальным 304/объёму):

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

Локально JSON прячет 304 — отключите или жёсткое обновление; для теста условных запросов снова включите:

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

| Среда | Рекомендация |
| --- | --- |
| Прод | Статика и полустатичные API — да; персонализированные API не обязаны иметь глобальный etag |
| Локально | Если мешает отладке — убрать или hard refresh |

При большом трафике кэш отдают CDN; ETag в приложении — когда хотите сами держать семантику 304. Если каждый ответ уникален, глобальный etag съедает CPU на digest.

## Дальше

- Сжатие: [Compress](/ru/plugins/compress)
- Статика: [serve-static](/ru/plugins/serve-static)
- Форма ответа: [response](/ru/web/response)