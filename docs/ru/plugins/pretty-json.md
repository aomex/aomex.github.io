---
outline: deep
---

# Красивый JSON

В разработке смотрите в браузере **JSON с отступами**, чтобы не искать поля в одной длинной строке. В проде по умолчанию выключено — иначе тело ответа заметно раздувается (особенно на мобильных), и публичный API не должен раздувать body через query.

```bash
pnpm add @aomex/pretty-json
```

## Монтирование на весь сайт в разработке

`prettyJson()` **после** `await next()` превращает JSON-ответ в текст с отступами; достаточно повесить в `WebApp.mount`. Локально включайте по среде; в проде — `enable: false`.

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

Обычный WebMiddleware; у ctx нет лишних полей. Пока Content-Type остаётся JSON, body становится читаемым текстом `JSON.stringify(..., null, spaces)`; объектные readable stream идут через потоковый stringify. Если команда привыкла к 4 пробелам — `spaces: 4` (по умолчанию `2`).

## В проде по запросу: только ?pretty

Если полноценную «красоту» в прод нельзя, выключите `enable` и оставьте только query-переключатель: отступы появятся на `/internal/debug/state?pretty`. Публичные маршруты этим раздувать ответ не стоит.

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально | `enable: true` или только `?pretty` |
| Прод | `enable: false`; не давайте публичным маршрутам раздувать ответ через query |

Полный pretty на больших списках может быть в разы больше компактного JSON — Postman тоже подвиснет. Совместно с [Compress](/ru/plugins/compress) объём чуть сожмётся, но корень — pretty удлинил body.

## Дальше

- Форма JSON-ответа: [Ограничение ответа](/ru/web/response)
- Сжатие объёма: [Compress](/ru/plugins/compress)
- UI документации в разработке: [Swagger UI](/ru/openapi/swagger-ui)
