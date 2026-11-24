---
outline: deep
---

# Время отклика

Записывает время обработки на сервере в заголовок каждого ответа (например, `X-Response-Time`) — удобно браузеру, шлюзу и интеграционным тестам, отслеживающим медленные эндпоинты. Без настроек: смонтируйте и готово.

```bash
pnpm add @aomex/response-time
```

## Рядом с журналом доступа

`responseTime()` без конфигурации; ставьте рядом с access log. После завершения запроса заголовок несёт длительность. Дополняет `access_log` в Nginx / поле `duration` в [httpAccessLog](/ru/plugins/http-access-log) (заголовок — клиенту/шлюзу, лог — агрегации). В проде журнал доступа чаще на периметре; плагин отвечает на вопрос «нужна ли длительность в заголовке ответа».

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

Используется `process.hrtime`; в заголовке часто вида `12.345ms`. Значение есть и при ошибках; в error-path может попасть в `HttpError.headers`.

Обычный `WebMiddleware`, типы бизнес-`ctx` не меняются. Смотрите в Network; в action заголовки вручную не пишете.

## Заголовок ответа vs access log

| Выход | Аудитория | Заметки |
| --- | --- | --- |
| `X-Response-Time` | Браузер, API-шлюз, тесты | Одинаково по всему сайту, независимо от смены маршрутов |
| `duration` в access log | Платформа логов, алерты, агрегация по маршрутам | См. [HTTP access log](/ru/plugins/http-access-log) |

Таблицы опций нет: **нужен заголовок — монтируйте; нет — не ставьте.** Обычно перед `routers`, рядом с access log.

| Среда | Рекомендация |
| --- | --- |
| Прод | Часто вместе с `httpAccessLog()` |
| Локально | Если только tail консоли, может хватить одного access log |

`X-Response-Time` — не end-to-end: до него ещё шлюз, TLS, очередь клиента. На публичном API заголовок можно срезать на периметре; для внутренних/своих фронтов обычно не критично. Если включён только `responseTime` без сохранения логов, на пике нагрузки всё равно нужен `duration` в агрегации (см. [HTTP access log](/ru/plugins/http-access-log)).

## Дальше

- Access log: [HTTP access log](/ru/plugins/http-access-log)
- Распределённый трейсинг: [Async trace](/ru/plugins/async-trace)
- [Middleware](/ru/core/middleware)
