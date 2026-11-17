# Слой сервисов

Вынеси из action маршрутов «запросы к БД, вызовы сторонних API, кэш» в переиспользуемые **Service**; собери типизированный мешок `services` через **combineServices** и вызывай одни и те же имена из Web, Console и Cron.

Бизнес-классы наследуют `Service` и отдают обычные async-методы; подключение — в `onInit`, освобождение — в `onDestroy` (оставь `protected`, не свети наружу).

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // Прогрев соединений, конфиг…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

Регистрируй фабрикой + `combineServices`; **инфраструктуру клади в `eager`**, чтобы приложение подключилось при старте, а не на первом продовом запросе:

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('./user.service.js'),
    cache: () => import('./cache.service.js'),
    logger: () => import('./logger.service.js'),
  },
  { eager: ['cache', 'logger'] },
);
```

После подключения к Web типы `services` идут из ключей `combineServices` и **публичных методов** каждого Service: `await services.user.findById(1)` с полной подсказкой аргументов и возврата; `onInit`, `onDestroy`, `private` **не** попадут на `services.user`. Синхронные методы Service снаружи всё равно типизируются как **Promise** — везде пиши `await`.

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
Не делай `new UserService()` в бизнесе, минуя `services` у `WebApp` / `ConsoleApp` — при остановке фреймворк не закроет соединения вне мешка.
:::

В маршрутах или middleware:

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

В других файлах — `import { services } from './services/index.js'`, без дополнительного augmentation модулей.

## Ленивая загрузка и подмена в тестах

В боевом коде — `() => import('./xxx.service.js')`, откладывает загрузку и ускоряет cold start:

```typescript
user: () => import('./user.service.js'),
```

В тестах фейк подставляй асинхронной фабрикой, возвращающей класс:

```typescript
user: async () => FakeUserService,
```

::: warning
В проде не пиши `async () => UserService` — класс уже в памяти с модулем, «ленивость» бесполезна и жрёт RAM. В проде всегда `() => import('./user.service.js')`; async-форма только для тестов.
:::

В каждом файле `export default class XxxService` — loader не гадает среди экспортов.

## eager

По умолчанию сервисы **ленивые**: первый `await services.xxx` создаёт экземпляр и вызывает `onInit`. Имена в `eager` готовятся до возврата `combineServices` — Redis, логи и всё, что должно быть готово при старте процесса.

```typescript
{ eager: ['cache', 'logger'] },
```

Локальный smoke или минимальный CLI может обойтись без `eager`. Если в `onInit` сервиса A есть `await services.cache.xxx`, а `cache` не в `eager`, подключение сдвинется на первый бизнес-вызов — на старте легко поймать гонки.

## Хуки жизненного цикла

Не всё должно быть Service и жить в `services` (модульный `PrismaClient`, внутренний Redis store плагина), но на старте нужно подключиться, при остановке — отключиться. Для этого `registerLifecycle`: `onInit` сразу при регистрации; `WebApp` / `ConsoleApp` вызовет `onDestroy` при shutdown.

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

Возвращаемая функция **снимает регистрацию** досрочно (после shutdown или отмены повторный вызов ничего не делает). При падении `onInit` в очередь destroy не попадаешь. Лимит запросов и другие плагины используют те же хуки для store — в приложении обычно регистрировать store повторно не нужно.

Классы уже в `combineServices` продолжают `onInit` / `onDestroy` — второй раз `registerLifecycle` не нужен.

## Объединение нескольких мешков

В больших репозиториях по доменам несколько `combineServices`, потом массив в App:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

Если имя класса оканчивается на `Service`, [`createRemember`](/ru/core/cache#декоратор-кэша) и похожие берут имя без суффикса для ключей кэша (`UserService` → `User`).

Межсервисные вызовы: в классе `import { services } from './index.js'`, затем `await services.other.method()`. Внутри класса — `this.foo()`; **между классами** — `await services.other.foo()`.

## Дальше

- Session и `createRemember`: [Кэш](/ru/core/cache)
- Общий лог: [Логирование](/ru/core/logger)
- Тонкие маршруты: [Маршрутизация](/ru/web/router)