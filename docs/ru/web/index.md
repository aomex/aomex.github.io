---
outline: deep
---

# Вход Web-приложения

Подними HTTP-сервис: заполни обязательные поля в `new WebApp`, подключи маршруты через `routers('./src/routers')`. Ниже — язык всего сайта, IP клиента, лимиты тела запроса и `ctx.send` / `ctx.throw` / `ctx.redirect` в маршрутах.

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';
import { services } from '@/services';

const app = new WebApp({ // [!code focus:7]
  services,
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP 服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

Пропуск `services`, `logger`, `language` или `proxyIP` в `new WebApp({ ... })` — ошибка компиляции. Если глобальный `mount` через `middleware.web` вешает поля на `ctx`, а `declare module` выше нет — в рантайме значения есть, в типах нет, в коде появятся `as`. С [response()](/ru/web/response) на маршруте форма body в `ctx.send` / `ctx.throw` сужается по объявлению.

::: warning
Глобальный `mount` добавил поля на `ctx`, но без `declare module` — в рантайме есть, в типах нет, в бизнес-коде лезут `as`.
:::

```bash
node --import tsx/esm --watch src/web.ts
```

Открой [http://localhost:3000](http://localhost:3000). Команду запуска лучше положить в `package.json` scripts и договориться о `pnpm start`.

Все поля ниже настраиваются в `new WebApp({ ... })`. Маршруты — «что делать на пути»; здесь — «как крутится весь сайт».

## services и logger

`services` — контейнер бизнес-сервисов (БД, почта и т.д.), собирается через [combineServices](/ru/core/service) и передаётся в WebApp. При остановке процесса фреймворк на этапе destroy вызывает `destroy` у загруженных сервисов, чтобы закрыть соединения.

`logger` — экземпляр [`Logger`](/ru/core/logger) (`new Logger({ transports })`). В коде — `import { logger } from '@/services/logger.service'`; `ctx.logger` — та же ссылка для сторонних и внутренних middleware. Кэш — [`Caching`](/ru/core/cache).

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services, // [!code highlight]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

Язык **ошибок `body()` / `query()` и встроенных сообщений фреймворка**. Коды — `zh-CN`, `en-US` (через дефис, не `zh_CN`). Это не locale Ant Design / Day.js и не бизнес-i18n — см. [продвинутую i18n](/ru/advanced/i18n).

| Режим | Когда |
| --- | --- |
| `fixed` + `language` | Внутренняя админка, один язык SaaS, без чтения заголовков |
| `dynamic` | Публичный API для разных клиентов, по запросу |
| `header: 'accept-language'` | Браузеры, стандартные клиенты (сортировка `q` по RFC) |
| `header: 'x-language'` | Свой заголовок приложения (через запятую, `q` обычно игнорируется) |
| `fallback` | Если заголовка нет или язык неизвестен |

Фиксированный язык:

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

По Accept-Language:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

Свой заголовок:

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

Проверка:

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
Не меняй язык в позднем middleware — к тому моменту `body()` / `query()` могли уже отдать ошибку на языке по умолчанию; для текстов фреймворка положись на `WebApp.language`. В Console только фиксированные строки — [вход Console](/ru/console/#language).
:::

## proxyIP

Заполняет `ctx.request.ip`. Ошибка конфигурации — неверный человек в rate limit и риск-контроле.

| Режим | Когда |
| --- | --- |
| `detect` | Локально `tsx`, тесты; неясно, есть ли reverse proxy — сначала завести |
| `specify` | Прод в интернет: доверять только заголовкам своего прокси, не подделке `X-Forwarded-For` |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
Не оставляй `detect` надолго в публичном проде: клиент может подделать типичные proxy-заголовки, лимиты и аудит ошибутся. На проде — `specify` и только свои заголовки.
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

`hops` должен совпадать с реальным числом прокси, иначе получишь внутренний адрес или CDN — поедут алерты «логин из другого места».

| Топология | Обычная настройка |
| --- | --- |
| Node напрямую в сеть / dev-машина | `detect` или `specify` без proxy-заголовков |
| Один Nginx → Node | `specify` + `x-forwarded-for`, `hops: 1` |
| CDN + свой Nginx | `x-forwarded-for`, `hops: 2` (по факту) |
| Только Cloudflare | `specify` + `cf-connecting-ip`, `hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` — глобальная очередь middleware: каждый запрос идёт по массиву (луковица, до и после `await next()`). CORS, auth на весь сайт, access log и `routers('./src/routers')` — сюда.

Логику для группы URL — в [Router](/ru/web/router) или mount одного маршрута, не всё в WebApp.

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

На `SIGTERM` / `SIGINT` (`docker stop`, Ctrl+C, rolling в K8s) WebApp делает **graceful shutdown**: не принимает новые соединения, дожидается текущих запросов, уничтожает services, выходит с кодом 0.

`timeout` — максимум ожидания (по умолчанию ~**5 с**, можно миллисекунды или `'10s'`). По истечении соединения рвутся принудительно, чтобы деплой не завис.

```typescript
shutdown: { timeout: 10_000 },
```

Локально редко трогают. На проде с загрузками, long poll и медленными запросами — увеличь под худший кейс. Во время shutdown новые запросы не принимаются — LB сначала снимает инстанс. С [clusterListen](/ru/advanced/cluster#clusterlisten) primary тоже ловит сигнал и координирует workers.

## Квоты body на уровне приложения

Перед upload или большими JSON webhook проверь, хватает ли дефолта; иначе ужесточи или ослабь на уровне app.

| Тип | Типичный Content-Type | Дефолт (ориентир) |
| --- | --- | --- |
| `payload` | JSON, urlencoded, text — всё в память | ~`2mb`, сверх — **413** |
| `formData` | `multipart/form-data` | ~`50mb` на файл, лимиты числа файлов/полей |

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```

[body()](/ru/web/body) с файлами на маршруте и лимиты `formData` на app — **строже из двух**. Загрузки — [файлы](/ru/web/attach).

Перед webhook или большим JSON смотри дефолт: тело целиком в память, сверх — **413**, не путать с **400** валидации. Часто мало менять только маршрут без `body.payload`.

## envelope

Когда нужна **одна JSON-оболочка** для успеха и ошибки, внешний HTTP **200**, реальный код в body — `envelope` в `new WebApp`. В маршрутах как раньше `send` / `throw`, обёртка перед записью.

Дерево из `envelope.success` / `envelope.payload` / `envelope.statusCode` и опционально `envelope.slot`; часто с [formatError](/ru/web/errors). Голый ответ — `response({ skipEnvelope: true })`. Правила пропуска (редирект, 204, SSE) — [обёртка ответа](/ru/web/envelope).

## listen, http, https

`listen` биндит HTTP к порту. Без вызова снаружи App недоступен. `app.listen(port)` = `app.http({}).listen(port)`, plain HTTP.

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```

На проде TLS чаще на Nginx / Caddy с прокси на Node HTTP — настрой `proxyIP`.

Docker scale, K8s, PM2, `clusterListen` — [кластер и масштаб](/ru/advanced/cluster).

## ctx.send

В action или глобальном middleware без кода статуса — **200**; 201, 204 — явно первым аргументом.

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```

## ctx.throw

Только **4xx / 5xx**. Бизнес-отказ — `ctx.throw`, не `throw new Error` — публичные 4xx не засоряют лог как 5xx.

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```

При `expose: true` message уходит клиенту — не клади SQL и внутренние пути.

## ctx.redirect

Постоянно **301**, временно **302** (без кода — 302).

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```

## download, sse, logger

Кратко об этих выходах в маршрутах:

- `ctx.download` — поток файла клиенту; Promise завершится после конца потока, удобно для временных файлов «скачал — удали».
- `ctx.sse()` — Server-Sent Events, [SSE](/ru/web/sse).
- Логи: `import { logger } from '@/services/logger.service'` (то же, что `ctx.logger`; `ctx.logger` — для middleware). `requestId` и т.п. — [лог · withBindings](/ru/core/logger#контекст-запроса-withbindings).

### app.on('error')

Не пойманные в action/middleware исключения — `emit('error', err, ctx)`. По умолчанию `logger.error` зависит от `expose`; подпишись для Sentry, чат-алертов.

**Не меняй body ответа здесь** — поздно, конфликт с уже отправленным. Единый JSON ошибок — [formatError](/ru/web/errors); оболочка success/data и HTTP 200 — [обёртка](/ru/web/envelope).

## Дальше

- [Маршруты](/ru/web/router): URL и HTTP-глаголы по файлам
- [query](/ru/web/query) / [params](/ru/web/params) / [body](/ru/web/body): валидация входа
- [Ограничение ответа](/ru/web/response): TypeScript и OpenAPI в унисон
- [SSE](/ru/web/sse): `ctx.sse`, stream, reconnect
- [Формат ошибок](/ru/web/errors): JSON после `ctx.throw`
- [Обёртка ответа](/ru/web/envelope): единая оболочка, HTTP 200 снаружи
- [Кластер](/ru/advanced/cluster): Docker / K8s / PM2 / `clusterListen`