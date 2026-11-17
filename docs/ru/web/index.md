---
outline: deep
---

# Точка входа Web-приложения

Поднимите HTTP-сервис: заполните обязательные опции `WebApp` и подключите маршруты через `routers('./src/routers')`. Ниже — язык сайта, IP клиента, лимиты тела запроса и использование `ctx.send` / `ctx.throw` / `ctx.redirect`.

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
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

Если в `new WebApp({ ... })` не указать `services`, `logger`, `language` или `proxyIP`, TypeScript выдаст ошибку. Поля на `ctx` из глобального `mount` через `middleware.web` требуют `declare module` выше — иначе в рантайме значения есть, а в типах нет, и придётся везде писать `as`. При [response()](/ru/web/response) на маршрутах типы тела для `ctx.send` / `ctx.throw` сужаются по объявлению.

::: warning
Глобальный `mount` добавляет поля на `ctx` без `declare module` → значения в рантайме есть, типов нет, повсюду приведения типов.
:::

```bash
node --import tsx/esm --watch src/web.ts
```

Откройте [http://localhost:3000](http://localhost:3000). Добавьте команду запуска в `scripts` в `package.json`, чтобы команда пользовалась `pnpm start`.

Эти поля задаются в `new WebApp({ ... })`. Маршруты отвечают на вопрос «что делает этот путь»; здесь — «как работает весь сайт».

## services и logger

`services` — контейнер бизнес-логики (БД, кэш, почта и т.д.) из [combineServices](/ru/core/service). При остановке фреймворк вызывает `destroy` у загруженных сервисов, чтобы закрыть соединения и сбросить логи.

`logger` передаётся отдельно (обычно `services.logger`): `ctx.logger` в маршрутах и middleware — тот же экземпляр, что и в конструкторе.

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

Задаёт язык **ошибок body() / query() и встроенных сообщений фреймворка**. Коды: `zh-CN`, `en-US` (с дефисом, не `zh_CN`). Только тексты фреймворка — не locale Ant Design / Day.js и не ваши строки продукта ([Расширенное: i18n приложения](/ru/advanced/i18n)).

| Режим | Когда использовать |
| --- | --- |
| `fixed` + `language` | Внутренняя админка, один язык SaaS |
| `dynamic` | Публичный API, согласование по запросу |
| `header: 'accept-language'` | Браузеры, стандартные клиенты (порядок `q` по RFC) |
| `header: 'x-language'` | Свой заголовок приложения (через запятую, обычно без `q`) |
| `fallback` | Если заголовка нет или язык неизвестен |

Фиксированный язык:

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

Согласование по `Accept-Language`:

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
Не задавайте язык слишком поздно в middleware — ранние `body()` / `query()` уже могли ответить с дефолтом; для сообщений фреймворка используйте `WebApp.language`. В Console — только строка; см. [Точка входа Console](/ru/console/#language).
:::

## proxyIP

Заполняет `ctx.request.ip`. Ошибка в настройке ломает rate limit и контроль рисков.

| Режим | Когда использовать |
| --- | --- |
| `detect` | Локальный `tsx`, тесты; топология прокси неясна |
| `specify` | Публичный прод — доверять только своим заголовкам прокси |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
Не держите `detect` в открытом интернете долго — клиент может подделать заголовки прокси. В проде используйте `specify` и доверяйте только своему reverse proxy.
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

`hops` должен совпадать с реальной глубиной прокси — иначе читается не тот hop, узел CDN или внутренний IP.

| Топология | Типичная настройка |
| --- | --- |
| Node напрямую в интернет / dev | `detect` или `specify` без заголовка прокси |
| Один Nginx → Node | `specify` + `x-forwarded-for`, `hops: 1` |
| CDN + ваш Nginx | `x-forwarded-for`, `hops: 2` (подстроить под факт) |
| Только Cloudflare | `specify` + `cf-connecting-ip`, `hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` — очередь middleware сайта: порядок массива, луковая модель, код до/после `await next()`. CORS, общая аутентификация, access log и `routers('./src/routers')` вешаются сюда.

Логику для одной группы URL лучше на [Router](/ru/web/router) или `mount` конкретного маршрута, а не всё в `WebApp`.

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

При `SIGTERM` / `SIGINT` (`docker stop`, Ctrl+C, rolling в K8s) `WebApp` **корректно завершается**: перестаёт принимать соединения, дожидается запросов в работе, уничтожает services, выходит с кодом 0.

`timeout` — максимальное ожидание (по умолчанию ~**5 с**; миллисекунды или строки вроде `'10s'`). По истечении соединения принудительно закрываются, чтобы процесс не зависал при деплое.

```typescript
shutdown: { timeout: 10_000 },
```

Локально редко меняют; в проде с загрузками, long poll и медленными запросами увеличьте под худший сценарий. Во время shutdown новых запросов нет — балансировщик должен сначала снять инстанс с балансировки. С [clusterListen](/ru/advanced/cluster#clusterlisten) сигналы получает и primary: он координирует выход worker’ов.

## Квоты body на уровне приложения

Перед большими upload или webhook JSON проверьте дефолты; ужесточите или ослабьте на уровне приложения.

| Тип | Типичный Content-Type | Дефолт (ориентир) |
| --- | --- | --- |
| `payload` | JSON, urlencoded, text в памяти | ~`2mb`, превышение → **413** |
| `formData` | `multipart/form-data` | ~`50mb` на файл, лимиты числа файлов/полей |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
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

Поля файлов в [body()](/ru/web/body) на маршруте и `formData` приложения берут **более строгий** лимит. Детали загрузки: [Загрузка файлов](/ru/web/attach).

Публичные webhook или крупный JSON: тело целиком в памяти; переполнение — **413**, не **400** валидации — одних правок маршрута без `body.payload` на приложении часто мало.

## envelope

Когда успех и ошибка делят одну JSON-обёртку с внешним HTTP **200** (реальный статус в body), задайте `envelope` на `new WebApp`. В маршрутах по-прежнему `send` / `throw`; обёртка на этапе flush.

Дерево из `envelope.success` / `envelope.payload` / `envelope.statusCode` и опционального `envelope.slot`; часто вместе с [formatError](/ru/web/errors). Детали и исключения (редирект, 204, SSE): [Обёртка ответа](/ru/web/envelope).

## listen, http, https

`listen` привязывает сервер; без него есть только объект `App` в памяти. `app.listen(port)` эквивалентен `app.http({}).listen(port)` для обычного HTTP.

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

В проде TLS чаще завершают Nginx / Caddy с проксированием на Node HTTP — настройте `proxyIP` согласованно.

Многопроцессность, Docker scale, реплики K8s, PM2 и `clusterListen` — в [Многопроцессность и масштабирование](/ru/advanced/cluster).

## ctx.send

В action или глобальном middleware без кода статуса по умолчанию **200**; 201, 204 и т.д. — явный первый аргумент.

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

Только **4xx / 5xx**. Бизнес-отказ — `ctx.throw`, а не `throw new Error` — явные 4xx не засоряют логи как 5xx.

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

При `expose: true` в ответе может быть `message` — не вставляйте SQL или внутренние пути.

## ctx.redirect

Постоянный **301**; временный часто **302** (по умолчанию при пропуске кода).

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

Другие способы ответа — на отдельных страницах:

- `ctx.download`: поток файла клиенту; Promise завершается после конца потока — удобно для временных файлов «скачал и удалил».
- `ctx.sse()`: server-sent events — [SSE](/ru/web/sse).
- `ctx.logger`: тот же `logger`, что передан в `WebApp`; поля на запрос — [Логгер · withBindings](/ru/core/logger#request-scoped-context-withbindings).

### app.on('error')

Не пойманные исключения в action/middleware дают `emit('error')` на приложении. Логирование по умолчанию учитывает `expose`; подпишитесь для Sentry, чат-ботов и т.д.

**Не меняйте тело ответа здесь** — часто уже поздно. Единый JSON ошибок: [Формат ошибок](/ru/web/errors); обёртка с HTTP 200: [Обёртка ответа](/ru/web/envelope).

## Дальше

- [HTTP-маршрутизация](/ru/web/router): URL и глаголы по файлам
- [query](/ru/web/query) / [params](/ru/web/params) / [body](/ru/web/body): триада валидации входа
- [Ограничение ответа](/ru/web/response): TypeScript и OpenAPI в одном ключе
- [SSE](/ru/web/sse): `ctx.sse` / поток / возобновление
- [Формат ошибок](/ru/web/errors): JSON после `ctx.throw`
- [Обёртка ответа](/ru/web/envelope): единая JSON-оболочка, HTTP 200
- [Многопроцессность и масштабирование](/ru/advanced/cluster): Docker / K8s / PM2 / `clusterListen`