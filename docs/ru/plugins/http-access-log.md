---
outline: deep
---

# HTTP access log

Одна строка на завершённый запрос: method, URL, status, duration — трафик и медленные эндпоинты.

**В проде предпочтительнее Nginx `access_log`** (или встроенный лог шлюза/LB): единый формат, меньше нагрузки на event loop Node, проще ingestion. `@aomex/http-access-log` — локальная разработка, без reverse proxy, или когда в логе нужны **userId / tenant / traceId**, доступные только в приложении.

```bash
pnpm add @aomex/http-access-log
```

## Рано и на весь сайт

`httpAccessLog()` **перед** `routers`, если нужен in-app access log: combined-строка после запроса; 404 и валидационные 400 учитываются. Позже — искажается полная длительность цепочки.

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

По умолчанию combined-подобная строка через logger (часто console). Поля: ip, method, url, statusCode, duration, contentLength.

::: warning
После `routers` длительность цепочки и ранние 404 могут не совпасть с «полным аудитом сайта».
:::

`customTokens` получают `WebContext`: `ctx.auth` и т.п. нужен **завершённый внутренний** auth — лог пишется после `await next()`, обычно видны внутренние props «луковицы». Если в `customTokens` всегда `-` для `ctx.auth`, проверьте порядок: auth на маршрутах, лог снаружи — возможно, поднять auth на `Router.mount`.

## Формат и приёмники

| Возможность | Когда использовать | По умолчанию |
| --- | --- | --- |
| `format` | Порядок полей под ELK/Loki в проде | встроенный combined |
| `transports` | Файл, удалённые коллекторы | console (через `logger`) |
| `customTokens` | userId, tenant, traceId | — |
| `HttpAccessLogToken.*` | Собрать `ip` / `method` / `duration` и т.д. | из пакета |

### Прод: файл

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

### userId после auth

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

Часто вместе с [Response time](/ru/plugins/response-time): заголовок клиенту/шлюзу, `duration` в логах — платформе.

| Среда | Рекомендация |
| --- | --- |
| Локально, прямой доступ | плагин в console; `responseTime()` для медленных маршрутов |
| Прод с Nginx | **предпочтительно** `access_log`; in-app только для custom tokens |
| Прод без прокси | файл или коллектор; отдельно от бизнес-логов |

Access log — трафик и latency, не единственный аудит чувствительных действий; добавьте бизнес-логи или audit-таблицы. Nginx и in-app могут сосуществовать — не плодите два конфликтующих формата.

## Дальше

- Заголовок времени: [Response time](/ru/plugins/response-time)
- Уровни и requestId: [Logger · withBindings](/ru/core/logger#request-scoped-context-withbindings)
