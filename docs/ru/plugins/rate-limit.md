---
outline: deep
---

# Ограничение частоты

Считает запросы по ключу клиента в окне; сверх лимита → **429** — защита от злоупотреблений и всплесков.

**Лимиты по IP/соединению на весь сайт — предпочтительно Nginx** (`limit_req_zone` / `limit_req`) — отсекает до Node; Redis между репликами не нужен. `@aomex/rate-limit` — **по user / API Key**, жёсткие лимиты на маршрутах (login, SMS) или временно без reverse proxy.

По умолчанию **в памяти** — одна машина; несколько реплик с in-app счётчиками нужен Redis, иначе эффективный лимит ≈ `maxRequest × число инстансов`.

```bash
pnpm add @aomex/rate-limit
# 多实例且必须在应用内共享计数：
pnpm add @aomex/rate-limit-redis-store ioredis
```

## Mount на весь сайт

Если периметр уже лимитирует по IP, второй site-wide `rateLimit()` в приложении не нужен. Для бизнес-ключей или локального доступа — `rateLimit()` рано: сверх лимита **429** без счётчиков в action. Общий счёт между репликами — Redis store ниже.

```typescript
import { rateLimit } from '@aomex/rate-limit';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    rateLimit({
      maxRequest: 100,
      duration: 60_000, // [!code highlight]
    }),
    routers('./src/routers'),
  ],
});
```

Обычный `WebMiddleware`; при превышении HTTP **429** — без ручных проверок в action. `id` → `false` пропускает учёт (health).

## Ключи и списки

| Опция | Когда использовать | По умолчанию |
| --- | --- | --- |
| `duration` | Длина окна | 1 час |
| `maxRequest` | Запросов в окне | 2500 |
| `id` | API Key / user; `false` — исключение | IP |
| `allowList` / `denyList` | Пропуск внутренних; блок IP | — |
| `store` | **Несколько инстансов — Redis** и т.п. | memory |

### По ключу / user, пропуск health

```typescript
rateLimit({
  maxRequest: 60,
  duration: 60_000,
  id: (ctx) => { // [!code highlight]
    if (ctx.request.pathname === '/health') {
      return false;
    }
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
  allowList: (ctx) => {
    return ctx.request.ip === '127.0.0.1';
  },
});
```

### Только один маршрут

```typescript
import { body } from '@aomex/web';
import { rule } from '@aomex/common';

router.post('/login', {
  mount: [
    rateLimit({ maxRequest: 10, duration: 60_000 }), // [!code highlight]
    body({ email: rule.email(), password: rule.string() }),
  ],
  action: async (ctx) => {
    /* ... */
  },
});
```

### Реплики в проде: Redis

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';
import Redis from 'ioredis';

rateLimit({
  store: new RateLimitRedisStore(new Redis()), // [!code highlight]
  maxRequest: 500,
  duration: 3_600_000,
  id: (ctx) => {
    const key = ctx.request.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return ctx.request.ip;
  },
});
```

| Среда | Рекомендация |
| --- | --- |
| Локально | In-app с мягкими лимитами — не заблокируйте себя |
| Прод с Nginx | **`limit_req` по IP**; в приложении — login, SMS, квоты по ключу |
| Несколько Pod + in-app | **Общий** `store` (Redis); не дублируйте жёсткий IP и на шлюзе |

Свои store — атомарный `getAndSet` по `RateLimitStore` из типов пакета.

Лимит только по IP за NAT — один ключ на офис; ложные срабатывания; login лучше по user или API Key. Слишком жёсткий site-wide — часто лимит на горячий маршрут.

## Дальше

- Реальный IP клиента (ключ лимита): [Точка входа](/ru/web/) `proxyIP`
- Измерение идентичности: [Auth](/ru/plugins/auth)
- Форма ошибок: [Формат ошибок](/ru/web/errors)
