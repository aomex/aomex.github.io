---
outline: deep
---

# Ограничение частоты запросов

Считай обращения по идентификатору клиента в окне времени; при превышении — **429**, чтобы сгладить брутфорс и всплески.

**Лимит по IP / соединению на весь сайт в проде — предпочитай Nginx** (`limit_req_zone` / `limit_req`): запрос не доходит до Node, несколько реплик не требуют Redis заранее. `@aomex/rate-limit` уместнее для **ключей по пользователю / API Key**, жёстких лимитов на логин / SMS или когда локально нет обратного прокси.

По умолчанию счётчик **в памяти процесса** — хватает на одну машину; при нескольких репликах и обязательном подсчёте в приложении нужен Redis, иначе эффективный потолок ≈ `maxRequest × число инстансов`.

```bash
pnpm add @aomex/rate-limit
# Несколько инстансов и общий счётчик в приложении:
pnpm add @aomex/rate-limit-redis-store
```

## Глобальный mount

Если на периметре IP уже режут, второй глобальный `rateLimit()` в приложении не обязателен. Нужны бизнес-ключи или прямой доступ — поставь `rateLimit()` в начало `mount`: превышение в окне сразу **429**, без счётчиков в каждом action. Общий счёт между репликами — Redis store ниже.

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

Обычный `WebMiddleware`; при превышении — HTTP-ошибка **429**, без ручных проверок в action. `id`, вернувший `false`, не участвует в счёте (часто для health check).

## Ключи счётчика и списки

| Опция | Когда | По умолчанию |
| --- | --- | --- |
| `duration` | Длина окна | 1 час |
| `maxRequest` | Допустимых запросов в окне | 2500 |
| `id` | По API Key / пользователю; `false` — пропуск | IP |
| `allowList` / `denyList` | Внутренняя сеть; блок IP | — |
| `store` | **Несколько инстансов — Redis** | память |

### По Key / пользователю, без health check

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

### Прод, несколько реплик: Redis

В конструктор передавай только **`RedisOptions`** (`host` / `port` и т.д.; типы из этого пакета) — **не** готовый экземпляр `Redis`. `ioredis` уже в `@aomex/rate-limit-redis-store`, отдельно ставить не нужно. У store `lazyConnect`; `rateLimit()` подключает и отключает через [`registerLifecycle`](/ru/core/service#хуки-жизненного-цикла) на уровне процесса.

```typescript
import { RateLimitRedisStore } from '@aomex/rate-limit-redis-store';

rateLimit({
  store: new RateLimitRedisStore({ // [!code highlight]
    host: '127.0.0.1',
    port: 6379,
  }),
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

Память по умолчанию можно явно взять из `@aomex/rate-limit/memory`; при shutdown счётчик в процессе очищается.

| Среда | Рекомендация |
| --- | --- |
| Локально напрямую | Можно лимит в приложении; держи запас, чтобы не заблокировать себя |
| Прод с Nginx | **Сначала** `limit_req` по IP / соединению; в приложении — логин, SMS, квоты по Key |
| Прод несколько Pod + счёт в приложении | **Обязательно** общий `store` (Redis); не наслаивай слишком жёсткий IP-лимит шлюза |

Свой store — атомарный `getAndSet` из `RateLimitStore` пакета; при connect/teardown переопредели `onInit` / `onDestroy` (`rateLimit()` зарегистрирует сам). Смотри типы.

Только по IP за NAT — один ключ на офис, легко задеть лишних; логин удобнее резать по пользователю или API Key. Слишком жёсткий глобальный лимит — чаще выносят hot-маршруты в отдельный `mount`.

## Дальше

- Honeypot / ошибки / блок IP: [Защита от злоупотреблений](/ru/plugins/abuse)
- Реальный IP (ключ лимита): `proxyIP` во [входе Web](/ru/web/)
- Измерение по идентичности: [Auth](/ru/plugins/auth)
- Формат ошибок: [Формат ошибок](/ru/web/errors)