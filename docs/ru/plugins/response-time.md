---
outline: deep
---

# Время ответа

Пишет в заголовок каждого ответа длительность обработки на сервере (например X-Response-Time) — для браузера, шлюза, интеграционных тестов. Без настроек: повесили и работает.

```bash
pnpm add @aomex/response-time
```

## Рядом с access log

`responseTime()` без конфигурации. Ставят рядом с access log: после запроса время попадает в заголовок ответа. Дополняет Nginx `access_log` / [httpAccessLog](/ru/plugins/access-log) duration (заголовок — клиент/шлюз, лог — агрегация на платформе). В проде access log чаще на edge; плагин решает только «нужен ли duration в заголовке».

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

Используется process.hrtime; в заголовке часто вида 12.345ms. Попадает и на ошибочные ответы; в error path может сливаться в HttpError.headers.

Обычный WebMiddleware, бизнес-тип ctx не меняет. Смотрите заголовки в Network, в action писать руками не нужно.

## Заголовок vs access log

| Вывод | Кому | Заметка |
| --- | --- | --- |
| `X-Response-Time` | Браузер, API gateway, тесты | Одинаково на всех роутах |
| `duration` в access log | Платформа логов, алерты, по роутам | См. [HTTP access log](/ru/plugins/access-log) |

Таблицы опций нет: **нужен заголовок — включите, нет — не вешайте.** Обычно перед routers, рядом с access log.

| Среда | Рекомендация |
| --- | --- |
| Прод | Часто вместе с `httpAccessLog()` |
| Локально | Только console tail — можно оставить один access log |

X-Response-Time — не полное end-to-end: перед ним шлюз, TLS, очередь клиента. Для публичного API заголовок можно снять на edge; для внутреннего/своего фронта обычно ок. Только responseTime без логов — в пике смотрите duration в агрегации логов ([HTTP access log](/ru/plugins/access-log)).

## Дальше

- Access log: [HTTP access log](/ru/plugins/access-log)
- Распределённый трейсинг: [async-trace](/ru/plugins/async-trace)
- [middleware](/ru/core/middleware)