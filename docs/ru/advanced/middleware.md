---
outline: deep
---

# Собственный middleware

в [Промежуточное ПО](/ru/core/middleware)`middleware.mixin `,`.skip()`(Функции поддержки или ` boolean `),` dependsOn `(Заимствовать только восходящий тип) Достаточно для ежедневного комбинирования. Обычно вы попадаете на эту страницу, потому что: **Вам нужно что-то делать во время выполнения и что-то прописывать в контракте при создании справки OpenAPI/CLI** — две вещи написаны в одном и том же промежуточном программном обеспечении, и если вы измените одну вещь, обе изменяются одновременно.

Затем нажмите «Сначала перехват веб-документа → Затем справка консоли → Наконец, межэтапное повторное использование», чтобы продолжить. После ввода вы получите middleware трассировки, которое может повлиять на Swagger, повесив его.

## Сначала различайте: миксин или веб/консоль

| эффект, который вы хотите | Что использовать |
| --- | --- |
| Меняйте только время выполнения ` ctx `, не беспокойтесь о документе | ` middleware.mixin `(См. [Промежуточное ПО](/ru/core/middleware)) |
| Интернет: среда выполнения + изменение операции OpenAPI | ` middleware.web({ fn, openapi })` |
| Консоль: среда выполнения + вклады `--help ` Дерево | ` middleware.console({ fn, help })` |

` middleware.web ` Экземпляры не могут быть напрямую связаны с консолью; ни наоборот. Когда нужны обе стороны, извлеките общую логику в обычные функции и оберните каждую в один слой.

## Шаг первый: сначала напишите среду выполнения, которая сможет работать

Цель: приносить с каждым запросом ` traceId`, нижестоящее действие может его прочитать.

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

Дженерики `{ readonly traceId: string }` написано в `middleware.web` После загрузки **более позднее middleware и то же действие маршрута** будут завершены. `ctx.traceId`. Он только присваивает значения и не пишет дженерики. Если во время выполнения есть поле, TypeScript все равно обрабатывает его так, как будто оно не существует.

Попробуйте, подключив его к приложению или маршруту:

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from './middlewares/trace-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
action: async (ctx) => {
  await services.logger.info('ok', { traceId: ctx.traceId });
  ctx.send({ ok: true });
};
```

В настоящее время инструкции, связанные с трассировкой, не будут отображаться в Swagger — среда выполнения и документ внедряются отдельно.

## Шаг 2. Добавьте перехватчик OpenAPI.

в том же ` middleware.web`объект параметра Рига ` openapi`. При создании маршрутов сканирования документов платформа вызывает эти перехватчики, чтобы вы могли изменить текущую операцию (или весь документ).

Общие входы (выбирайте по типу подсказки, полностью писать не нужно):

| крюк | когда использовать |
| --- | --- |
| ` onMethod ` | Добавьте параметры, ответ и безопасность к текущей операции. |
| ` postMethod ` | Позвольте другим сначала закончить письмо, а затем закончить (например, объединить конверт) |
| ` onDocument ` | зарегистрироваться` components.securitySchemes `глобальные блоки |

Повесьте трубку за каждого` traceId `Интерфейс добавляет описание заголовка ответа:

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

Перезапустите [Генерация OpenAPI](/ru/plugins/openapi) или откройте Swagger: вы сможете увидеть его во время операции с зависшим промежуточным программным обеспечением. ` X-Trace-Id `. Если исправить неправильную структуру в крючке, она не появится. ` pnpm start ` Если сообщается об ошибке, проверьте ее в сгенерированных результатах.

::: tip
Если промежуточное ПО во время работы ничего не делает, а только меняет документ, сначала спросите себя, можно ли это записать в маршрутизацию. ` docs ` Или в конфигурации генератора — запуск пустого слоя затруднит чтение монтирования.
:::

## Шаг 3. Та же процедура на стороне консоли.

Инструкции по переходу `--help ` При вставке абзаца объяснения используйте ` middleware.console `+` help `:

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 按类型提示往帮助树贡献说明；具体字段以编辑器补全为准
    },
  },
});
```

подожди ` commander.create`из ` mount`и в Интернете ` openapi`Симметрия: контракт HTTP с одной стороны, поддержка CLI с другой.

## Шаг 4. Обе стороны разделяют одну и ту же логику

Не дублируйте логику UUID дважды. Извлеките функцию и оберните ее:

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
    /* 同上 */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## Что вы видите, когда есть несоответствие?

| Феномен | По большей части |
| --- | --- |
| Не в действии ` ctx.traceId ` Полный | ` middleware.web `/` mixin ` Отсутствуют дженерики реквизита |
| При запуске есть заголовок, но его нет при использовании Swagger. | Написал ` fn ` Забыл ` openapi `, или маршрут для подключения промежуточного программного обеспечения не был просканирован во время генерации. |
| Консоль зависла ` middleware.web ` ошибка типа | Сцена не та, ее надо менять ` middleware.console ` |
| Проверка работоспособности по-прежнему заблокирована аутентификацией | использовать `.skip()`, см. [中间件 · skip](/ru/core/middleware#用-skip-绕过某类请求) |

## Связанный

- заказ,`.skip()`,` dependsOn`, слияние ctx: [Промежуточное ПО](/ru/core/middleware)
- Готовые плагины: [Журнал HTTP-доступа](/ru/plugins/http-access-log), [Запись аутентификации](/ru/plugins/auth)
- Создать документацию: [Генерация OpenAPI](/ru/plugins/openapi)