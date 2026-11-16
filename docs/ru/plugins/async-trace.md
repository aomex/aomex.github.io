---
outline: deep
---

# Асинхронный трейс

Access log говорит «запрос занял 800 ms». Чтобы увидеть **какие await съели время**, соберите дерево внутри запроса — для медленных маршрутов и цепочек IO в сервисах. Для обычного CRUD можно не ставить; для классического распределённого трейсинга — OpenTelemetry; этот пакет легче и in-process.

## traceMiddleware на весь запрос

Ставьте при необходимости:

```bash
pnpm add @aomex/async-trace
```

Оберните весь запрос:

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';

mount: [
  traceMiddleware('request', (record) => { // [!code highlight]
    if (record.duration > 500) {
      void asyncTrace.toStack([record]);
    }
  }),
  routers('./src/routers'),
],
```

Без `traceMiddleware` в рантайме и в типах не будет `ctx.asyncTrace` — смонтируйте middleware или используйте только локальный `traceBlock`.

Локальные блоки в сервисах:

```typescript
import { traceBlock } from '@aomex/async-trace';

const data = await traceBlock('loadUser', async () => { // [!code highlight]
  const profile = await db.profile.find();
  const prefs = await db.prefs.find();
  return { profile, prefs };
});
```

Декоратор метода (чище, чем ручной `traceBlock`, когда в методе много await):

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

Без метки по умолчанию что-то вроде `ClassName.methodName` — удобно в стеках.

После `traceMiddleware` в Web-контексте **AsyncTraceMiddlewareProps**: в запросе **ctx.asyncTrace.record** (точные поля — из подсказок типов). `traceMiddleware` — **mixin** middleware, не только `middleware.web`; подходит Web mount, Console и command mount. `asyncTrace.run(label, callback)` открывает дочерние узлы; вложенный `toStack` печатает дерево. В записи обычно label, duration, parent/children, error — для отладки часто хватает duration и label.

## Уровни mount и callback

| Сценарий | Использование |
| --- | --- |
| Весь HTTP-сайт | `WebApp.mount: [traceMiddleware('http')]` |
| Одна группа API | `Router.mount: [traceMiddleware('api-v1')]` |
| Console-задачи | `ConsoleApp` / command `mount` |
| Горячие методы | `@traceMethod()` или `traceBlock` |
| Логировать медленные запросы | второй аргумент `traceMiddleware` — callback; в проде не сливайте полные стеки на горячих путях |

::: warning
Безлимитные дампы стека в проде жрут CPU; порог или семплирование в callback до отправки в логи.
:::

Дополняет [@aomex/http-access-log](/ru/plugins/http-access-log): access log — суммарное время, trace — подшаги. Не заменяет OpenTelemetry для межсервисных трасс.

## Связанное

- Порядок middleware: [Web-приложение](/ru/web/), [Свой middleware](/ru/advanced/middleware)
- requestId в логах: [Logger · withBindings](/ru/core/logger#request-scoped-context-withbindings)
