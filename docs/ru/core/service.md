# Слой сервисов

Вынесите «запросы к БД, вызовы API, кэш» из action маршрута в переиспользуемые **Service**; соберите типизированный мешок `services` через **combineServices** и вызывайте под теми же именами в Web, Console и Cron.

Бизнес-класс наследует `Service`, наружу — обычные async-методы; подключение и прогрев — в `onInit`, освобождение — в `onDestroy` (protected, снаружи не вызывайте).

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // прогрев подключения, чтение конфига…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

Регистрация через фабрики + `combineServices`. **Сервисы, которые должны подключиться при старте процесса**, — в eager (Prisma, внешние SDK):

```typescript
import { combineServices } from '@aomex/common';

export const services = await combineServices( // [!code highlight]
  {
    user: () => import('@/services/user.service'),
  },
  { eager: ['user'] },
);
```

После передачи в Web тип `services` идёт из ключей combineServices и **публичных методов** каждого Service: `await services.user.findById(1)` с полным дополнением аргументов и результата; `onInit`, `onDestroy`, private **не** на `services.user`. Синхронные методы снаружи типизируются как **Promise** — пишите `await`.

```typescript
import { WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services, // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

::: tip
Не делайте `new UserService()` в коде без передачи в `services` WebApp / ConsoleApp — при shutdown фреймворк не закроет ресурсы.
:::

В маршруте или middleware:

```typescript
import { logger } from '@/services/logger.service';

const user = await services.user.findById(1);
logger.info(`用户已查询 ${user?.name ?? ''}`);
```

В других файлах: `import { services } from '@/services'`, без дополнительного augmentation модуля.

## Ленивая загрузка и подмена в тестах

В проде — `() => import('@/services/xxx.service')` для отложенной загрузки и быстрого cold start:

```typescript
user: () => import('@/services/user.service'),
```

В тестах async-фабрика может вернуть подделку:

```typescript
user: async () => FakeUserService,
```

::: warning
В проде не пишите `async () => UserService`: класс уже в памяти с модулем, ленивость бессмысленна и жрёт RAM. В проде только `() => import('@/services/user.service')`; вариант выше — для тестов.
:::

Удобнее всего `export default class XxxService` в каждом файле — loader не угадывает несколько экспортов.

## eager

По умолчанию сервисы **ленивые**: первый `await services.xxx` создаёт экземпляр и гоняет `onInit`. Имена в `eager` строятся до возврата `combineServices` — для «подключиться сразу при старте» (Prisma).

```typescript
{ eager: ['user', 'prisma'] },
```

Локально и минимальный CLI могут обойтись без eager. Если в `onInit` A нужен `await services.user.xxx`, а user не в eager, инициализация отложится до первого вызова — ловушки порядка на старте.

## Хуки жизненного цикла

Ресурсы вне мешка `services` (модульный PrismaClient, Redis store внутри плагина) всё равно могут требовать connect на старте и disconnect на остановке — `registerLifecycle`: `onInit` сразу при регистрации, `onDestroy` при shutdown WebApp / ConsoleApp.

Для ленивого connect (адаптер, свой клиент) часто «защёлка + сброс при ошибке» — **автоповтора нет**:

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let ready: Promise<void> | undefined;

function ensureReady() {
  ready ??= registerLifecycle({ // [!code focus:7]
    onInit: () => prisma.$connect(),
    onDestroy: () => prisma.$disconnect(),
  }).catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
```

Разовое подключение (скрипт старта, top-level модуля) — `await registerLifecycle({ … })`. Возвращаемая функция **снимает регистрацию** досрочно (после shutdown/отмены — no-op). При сбое `onInit` в очередь destroy не попадаете. Rate limit и плагины используют те же хуки — обычно не дублируйте с бизнес-стороны.

Классы уже в `combineServices` живут на `onInit` / `onDestroy` без лишнего `registerLifecycle`.

## Слияние нескольких мешков

В крупном репо — несколько combineServices по доменам, затем массив в App:

```typescript
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

Для имён, оканчивающихся на Service, [`createRemember`](/ru/core/cache#декоратор-кэша) и подобное берут имя без суффикса в ключах кэша (UserService → User).

Межсервисные вызовы: в классе `import { services } from '@/services'`, `await services.other.method()`. Внутри класса — `this.foo()`; **между классами** — `await services.other.foo()`.

## Дальше

- Общий `Caching`, `createRemember`: [кэш](/ru/core/cache)
- Общий `Logger`: [логирование](/ru/core/logger)
- Тонкие маршруты: [маршрутизация](/ru/web/router)