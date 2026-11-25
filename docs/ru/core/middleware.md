# Middleware

Повесьте на весь сайт или группу API слой «что сделать при входе запроса и после бизнес-логики», чтобы downstream action видел поля на `ctx` (например `requestId`).

Middleware — одна функция. Не забудьте `await next()` — иначе запрос не пойдёт дальше. Логику можно писать до и после вызова `next`.

```typescript
import { middleware } from '@aomex/common';

export const withRequestId = middleware.mixin<{
  readonly requestId: string;
}>(async (ctx, next) => { // [!code highlight]
  ctx.requestId = crypto.randomUUID();
  await next();
});
```

::: warning
Последующие middleware и обработчики завязаны на `await next()`. При сбое auth можно не вызывать, но не пропустите случайно. **Обязательно `await next()`**, иначе асинхронные ошибки ниже часто остаются необработанными Promise.
:::

После `middleware.mixin<{ … }>` с объявлением новых полей **более поздние middleware и action того же маршрута** получают дополнение; без generic, только присвоение в рантайме — компилятор поля «не видит».

```typescript
import { logger } from '@/services/logger.service';

// в action
async (ctx) => { // [!code highlight]
  logger.info(`请求 ${ctx.requestId}`);
  return { ok: true };
};
```

Поля от нескольких mixin сливаются в один `ctx` на уровне типов. Только рантайм без generic работает, но TypeScript не помогает при переименованиях.

## WebApp.mount

`WebApp.mount` — общая «луковица»: CORS, access log, formatError, `routers(...)` по порядку массива. Чем раньше, тем снаружи — оборачивает все маршруты до/после `await next()`.

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from '@/middlewares/request-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

CORS, requestId на весь сайт, access log — в `WebApp.mount` / `ConsoleApp.mount`.

## Router.mount

Общая логика на группу URL (единая auth, аудит, formatError под prefix) — `Router({ mount })`, только пути из этого файла, без обёртки всего сайта в WebApp.

```typescript
import { Router } from '@aomex/web';

// вся группа ресурсов требует входа (auth — ваш экземпляр Auth)
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

Единая auth на класс ресурсов — Router.mount; публичные API — отдельный Router, не цепочка skip на одном Router.

## mount одного маршрута

`mount` на одном маршруте выполняется только перед его action: свой body/query, жёстче authorize, исключения среди публичных. Для обычной валидации — встроенные query / body / cors / auth, не middleware везде.

```typescript
import { rule } from '@aomex/common';
import { body } from '@aomex/web';

router.post('/login', { // [!code focus:11]
  mount: [
    body({ // [!code highlight]
      email: rule.email(),
      password: rule.string(),
    }),
  ],
  action: async (ctx) => {
    ctx.send({ token: '...' });
  },
});
```

## Обход через skip

Когда для части путей или окружения не нужен весь слой (health без auth, в тесте выключить слой) — `.skip(...)` на существующем middleware: при `true` сразу `next()`, без исходной логики; меньше дублирования `mount`.

Можно **функцию** (по запросу) или **`boolean`** (фиксировано на этапе сборки):

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// в тесте выключить слой целиком
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// временно отключить (как убрать из mount)
someMiddleware.skip(true);
```

::: warning
`.skip()` **не меняет Props**: при пропуске auth тип всё ещё «есть» `ctx.auth` — ветку «не залогинен» обрабатывайте в action. Много публичных маршрутов — лучше отдельный Router без auth, чем ряд skip на одной цепочке.
:::

## dependsOn — заимствовать тип upstream

Если middleware **предполагает**, что выше уже висит слой (auth, middleware с `userId`), и нужны эти поля в `fn` без повторного выполнения upstream — `middleware.dependsOn(upstream).web(...)` / `.mixin(...)` / `.console(...)`.

`dependsOn` только для **типов**; в рантайме переданный middleware не вызывается — порядок в `mount` решает выполнение.

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// считаем withUser уже выше: ctx.userId дополняется, withUser не выполняется снова
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```

При монтировании upstream спереди:

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

Допустимы фабрики / async-фабрики (как ленивая загрузка в `combineServices`, здесь — только типы). Несколько `dependsOn` подряд — поля накапливаются.

::: tip
`Middleware.Infer<typeof loadProfile>` **не включает** Props из `dependsOn` — снаружи слой «ничего на ctx не добавляет». Заимствование типа действует только на `ctx` в `fn` (и один следующий `.skip(ctx => …)`).
:::

В быту — готовые query, body, cors, auth. Хуки OpenAPI / CLI help — [пользовательский middleware](/ru/advanced/middleware).

## Дальше

- Валидация и тексты 400: [тело запроса](/ru/web/body), [query string](/ru/web/query)
- Auth middleware: [единая точка Auth](/ru/plugins/auth)
- Хуки OpenAPI / Help: [пользовательский middleware](/ru/advanced/middleware)