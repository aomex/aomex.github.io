---
outline: deep
---

# Красивый JSON

В разработке отдавайте в браузере **с отступами JSON**, а не одну длинную строку. В проде по умолчанию выключайте — объём ответа растёт (особенно на мобильных), публичному API не стоит раздувать body через query.

```bash
pnpm add @aomex/pretty-json
```

## Монтирование в разработке

`prettyJson()` **после** `await next()` переформатирует JSON-ответы в текст с отступами — в `WebApp.mount`. В проде `enable: false` или только `?pretty`.

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

Обычный `WebMiddleware`; лишних полей на `ctx` нет. При JSON Content-Type тело становится читаемым `JSON.stringify(..., null, spaces)`; для object-mode потоков — потоковый stringify.

## Переключатели `enable` и `query`

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `enable` | В проде обязательно `false`; внутренние утилиты можно включить | `true` |
| `query` | Без глобального pretty; только при `?pretty` | — |
| `spaces` | 2 или 4 пробела по привычке команды | `2` |

```typescript
prettyJson({ spaces: 4 });
```

### Только внутренняя сеть / по запросу

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| Среда | Рекомендация |
| --- | --- |
| Локально | `enable: true` или только `?pretty` |
| Прод | `enable: false`; не дайте публичным маршрутам раздувать ответ через query |

Pretty для больших списков может быть в разы больше компактного JSON — Postman тоже «тяжелеет». С [Compress](/ru/plugins/compress) часть байт вернётся, но корень проблемы — удлинённое тело.

## Дальше

- Форма JSON-ответа: [Ограничения response](/ru/web/response)
- Сжать payload: [Compress](/ru/plugins/compress)
- UI API в разработке: [Swagger UI](/ru/openapi/swagger-ui)
