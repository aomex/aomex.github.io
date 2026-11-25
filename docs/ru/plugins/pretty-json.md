---
outline: deep
---

# Красивый JSON

В разработке в браузере видите **JSON с отступами**, а не одну длинную строку. В проде по умолчанию выключено — тело ответа заметно растёт (особенно на мобиле). Публичный API не должен раздувать body через query.

```bash
pnpm add @aomex/pretty-json
```

## На весь сайт в dev

`prettyJson()` **после** `await next()` превращает JSON-ответ в текст с отступами — в `WebApp.mount`. Локально по среде включают, в проде `enable: false`.

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
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

Обычный WebMiddleware, без новых полей на ctx. Пока Content-Type JSON, body становится читаемым `JSON.stringify(..., null, spaces)`. ReadStream в object mode — потоковый stringify. Привычка 4 пробела — `spaces: 4` (по умолчанию `2`).

## Прод: только по `?pretty`

Глобальный pretty в прод не ставят: `enable: false`, остаётся query — индентация только на `/internal/debug/state?pretty`. Публичные роуты не должны раздувать ответ через query.

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально | `enable: true` или только `?pretty` |
| Прод | `enable: false`; публичные роуты без опоры на query |

Большие списки целиком в pretty — в разы больше компактного JSON, Postman тоже тормозит. С [Compress](/ru/plugins/compress) чуть сжимается, но корень — длиннее body из-за pretty.

## Дальше

- Форма JSON-ответа: [response](/ru/web/response)
- Сжатие: [Compress](/ru/plugins/compress)
- Док UI в dev: [Swagger UI](/ru/openapi/swagger-ui)