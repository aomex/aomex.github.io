---
outline: deep
---

# Асинхронная трассировка

Access log скажет лишь «этот запрос занял 800 ms». Чтобы увидеть, **какие await съели время**, внутри запроса собирается дерево — удобно для медленных API и разбора цепочки IO в Service. На обычный CRUD по умолчанию не опирайтесь; для стандартной распределённой трассировки смотрите OpenTelemetry — этот пакет легче и ближе к отладке внутри приложения.

```bash
pnpm add @aomex/async-trace
```

## Обёртка всего запроса

Повесьте `traceMiddleware` в `WebApp.mount` (или на группу Router): на каждый запрос открывается корневой узел; второй аргумент — колбэк после запроса, удобно «логировать только медленные» и стыковать с логгером.

```typescript
import { asyncTrace, traceMiddleware } from '@aomex/async-trace';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:8]
    traceMiddleware('request', (record) => {
      if (record.duration > 500) {
        void asyncTrace.toStack([record]);
      }
    }),
    routers('./src/routers'),
  ],
});
```

После монтирования Web-контекст объединяет **AsyncTraceMiddlewareProps**: в запросе доступен `ctx.asyncTrace.record` (поля — по подсказкам типов). Без middleware ждать `ctx.asyncTrace` бессмысленно — ни в типах, ни в runtime корневой записи не будет; либо повесьте middleware, либо используйте локальный `traceBlock`.

`traceMiddleware` — **mixin**-middleware, не фабрика только для `middleware.web`, но его можно класть прямо в Web mount; на Console / command mount тоже. Если тормозит одна группа API и не нужен оверхед на весь сайт — вешайте на mount этого Router.

::: warning
В проде полный дамп стека без порога даёт runtime-стоимость; в callback фильтруйте по duration или сэмплируйте в систему логов.
:::

## Разбор горячих точек в Service

На всём запросе видна только суммарная длительность; чтобы понять «какой запрос в БД медленный», оберните await в Service через `traceBlock`. При вложенности `toStack` печатает структуру с отступами.

```typescript
import { traceBlock } from '@aomex/async-trace';

async loadUser(id: number) {
  return traceBlock('loadUser', async () => { // [!code focus:5]
    const profile = await db.profile.find(id);
    const prefs = await db.prefs.find(id);
    return { profile, prefs };
  });
}
```

Когда в методе класса несколько await, декоратор чище ручного `traceBlock`; без label по умолчанию что-то вроде `ClassName.methodName` — удобно читать стек:

```typescript
import { traceMethod } from '@aomex/async-trace';

class UserService {
  @traceMethod() // [!code highlight]
  async load() {
    return [];
  }
}
```

`asyncTrace.run(label, callback)` открывает дочерний узел в уже начатом дереве. В записи обычно есть label, duration, parent / children, error — для отладки часто хватает duration и label.

Дополняет [@aomex/access-log](/ru/plugins/access-log): access log пишет суммарное время, трассировка — шаги. Пакет не заменяет распределённый trace вроде OpenTelemetry; между сервисами нужна стандартная схема.

## Связанное

- Порядок middleware: [Web-приложение](/ru/web/), [Свой middleware](/ru/advanced/middleware)
- Логи с requestId: [Логи · withBindings](/ru/core/logger#контекст-запроса-withbindings)
