---
outline: deep
---

# Пользовательский middleware

В [middleware](/ru/core/middleware) хватает `middleware.mixin`, `.skip()` (функция или `boolean`) и `dependsOn` (только заимствовать типы upstream) для повседневной компоновки. Сюда обычно приходят, когда нужно **и в рантайме что-то делать, и при генерации OpenAPI / справки CLI дописать строку в контракт** — одним middleware, одно место правки.

Ниже: «сначала Web-хуки документации → Console help → переиспользование между сценами». Дойдёте до конца — получите trace-middleware, который влияет на Swagger.

## Сначала разделите: mixin или web / console

| Нужный эффект | Что брать |
| --- | --- |
| Только менять `ctx` в рантайме, документ не трогать | `middleware.mixin` (см. [middleware](/ru/core/middleware)) |
| Web: рантайм + правка operation в OpenAPI | `middleware.web({ fn, openapi })` |
| Console: рантайм + вклад в дерево `--help` | `middleware.console({ fn, help })` |

Экземпляр `middleware.web` **нельзя** повесить на Console и наоборот. Нужны оба — вынесите общую логику в обычную функцию и оберните по разу.

## Шаг 1: рабочий рантайм

Цель: на каждый запрос `traceId`, чтобы downstream action мог читать.

```typescript
// src/middleware/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```

Generic `{ readonly traceId: string }` на `middleware.web` даёт дополнение `ctx.traceId` в **более позднем middleware и action той же маршрута**. Только присвоение без generic — в рантайме поле есть, TypeScript его не видит.

Повесьте на приложение или маршрут и проверьте:

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from '@/middlewares/trace-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
import { logger } from '@/services/logger.service';

action: async (ctx) => {
  logger.info(`ok ${ctx.traceId}`);
  ctx.send({ ok: true });
};
```

В Swagger про trace пока ничего — рантайм и документ инжектятся отдельно.

## Шаг 2: хук OpenAPI

В тот же объект аргументов `middleware.web` добавьте `openapi`. При генерации документа по маршрутам фреймворк вызывает хуки, чтобы менять текущую operation (или весь document).

Частые точки входа (по подсказкам типов, не обязательно все):

| Хук | Когда |
| --- | --- |
| `onMethod` | параметры, ответы, security **для этой** operation |
| `postMethod` | финал после других (например общий envelope) |
| `onDocument` | глобальные блоки вроде `components.securitySchemes` |

Добавить описание заголовка ответа на все маршруты с `traceId`:

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```

Запустите [генерацию OpenAPI](/ru/openapi/) или откройте Swagger: на operation с этим middleware должен появиться `X-Trace-Id`. Ошибка структуры в хуке редко всплывает на `pnpm start` — сверяйте с результатом генерации.

::: tip
Если middleware **ничего не делает в рантайме**, а только документ — сначала проверьте, не хватит ли `docs` на маршруте или настроек генератора; пустой слой усложняет чтение `mount`.
:::

## Шаг 3: тот же приём в Console

Когда команде нужен кусок в `--help` — `middleware.console` + `help`:

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // по типам — вклад в дерево help; поля — из автодополнения редактора
    },
  },
});
```

Вешайте на `mount` в `commander.create`. Симметрично `openapi` в Web: HTTP-контракт и справка CLI.

## Шаг 4: одна логика на оба сцена

Не дублируйте UUID. Вынесите функцию и оберните:

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* как выше */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## Типичные симптомы

| Симптом | Чаще всего |
| --- | --- |
| Нет дополнения `ctx.traceId` в action | забыли Props-generic на `middleware.web` / `mixin` |
| Заголовок в рантайме есть, в Swagger нет | есть `fn`, нет `openapi`, или генерация не увидела маршрут с middleware |
| `middleware.web` на Console — ошибка типов | неверный сцен; нужен `middleware.console` |
| Health всё ещё режется auth | `.skip()`, см. [middleware · skip](/ru/core/middleware#обход-через-skip) |

## См. также

- Порядок, `.skip()`, `dependsOn`, слияние ctx: [middleware](/ru/core/middleware)
- Готовые плагины: [access log](/ru/plugins/access-log), [единая точка Auth](/ru/plugins/auth)
- Генерация документации: [генерация OpenAPI](/ru/openapi/)