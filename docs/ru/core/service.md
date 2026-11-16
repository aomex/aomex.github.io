# Слой сервисов

Уберите «проверку базы данных, стороннюю настройку и кэш чтения и записи» из действия маршрутизации, чтобы получить повторно используемую **Сервис**; используйте **combineServices** для формирования типизированного пакета сервисов и вызывайте его с тем же именем в Интернете, консоли и Cron.

Бизнес-класс наследует Service и предоставляет внешнему миру только обычные асинхронные методы; подключение библиотеки и предварительный нагрев размещаются в onInit, а релиз — в onDestroy (сохраняйте его защищенным и не вызывайте напрямую извне).

```typescript
import { Service } from '@aomex/common';

export default class UserService extends Service {
  private cache = new Map<number, { name: string }>();

  protected override async onInit(): Promise<void> { // [!code highlight]
    // 预热连接、读配置…
  }

  protected override async onDestroy(): Promise<void> {
    this.cache.clear();
  }

  async findById(id: number) {
    return this.cache.get(id) ?? null;
  }
}
```

Зарегистрируйтесь на заводе+комбайнеServices; **Инфраструктуру рекомендуется писать в нетерпеливом формате**. Подключите приложение сразу после его запуска. Не ждите инициализации первого онлайн-запроса:

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

После получения Интернета тип сервисов определяется непосредственно именем ключа объединенияServices и **публичным методом** каждого Сервиса: await Services.user.findById(1) имеет полные параметры и завершение возвращаемого значения; Поля onInit, onDestroy и частные **не** появятся в файле Services.user. Для методов службы, написанных синхронно, по-прежнему нажимайте **Promise** при вызове типа времени извне и просто записывайте await унифицированным способом.

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
Не используйте new UserService() в своем бизнесе, но и не передавайте его службам WebApp/ConsoleApp — фреймворк не сможет управлять им, когда он выключен, и соединение может быть пропущено.
:::

В маршрутизации или промежуточном программном обеспечении:

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

Импортируйте {services} из «./services/index.js» в другие файлы, и нет необходимости вносить дополнительные улучшения в модуль.

## Ленивая загрузка и тестовая инъекция

Используется в официальном коде `() => import('./xxx.service.js')` Задержка загрузки, холодный старт происходит быстрее:

```typescript
user: () => import('./user.service.js'),
```

Внедрение поддельных реализаций в тесты можно записать как асинхронную фабрику, которая напрямую возвращает класс:

```typescript
user: async () => FakeUserService,
```

::: warning
Не пишите бизнес-код как ` async () => UserService`. Класс внесен в память вместе с текущим модулем, поэтому ленивая загрузка бесполезна и беспричинно занимает память времени выполнения. Формальная среда та же. `() => import('./user.service.js')`;Вышеуказанный метод записи предназначен только для тестового внедрения.
:::

за файл ` export default class XxxService`Самый беспроблемный загрузчик, которому не нужно угадывать несколько экспортов.

## жаждущий

Служба по умолчанию **отложенная загрузка**: первый раз. ` await services.xxx`Просто создайте экземпляр и запустите ` onInit`. ` eager`Имена, перечисленные в, будут в ` combineServices`Соберите его перед возвратом — подходит для такой инфраструктуры, как Redis, и журналов, которые «готовы, как только процесс будет запущен».

```typescript
{ eager: ['cache', 'logger'] },
```

Вам не нужно писать, стремясь к локальному пробному запуску и минималистичному CLI. Если в А ` onInit`Ли Яо ` await services.cache.xxx`, а кэш не активен, подключение к библиотеке будет отложено до первого бизнес-вызова, и на этапе запуска легко столкнуться с ошибками синхронизации.

## Несколько сумок вместе

Окура разделяет несколько объединенных сервисов по доменам, а затем объединяет их и передает в приложение:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

Когда имя класса заканчивается на Service, [@remember](/ru/core/cache#方法装饰器-remember) и т. д. будут использовать имя без суффикса, чтобы отличить ключ кэша (UserService → User).

Службы вызывают друг друга: импортируйте {services} из './index.js' в классе, а затем ожидайте Services.other.method(). Напишите this.foo() внутри класса, как обычно; используйте await Services.other.foo() только в разных классах.

## Дальше

- Сеансы с Redis: [Кэш](/ru/core/cache)
- Экспорт полного журнала сайта: [Регистратор](/ru/core/logger)
- Как написать маршрут: [HTTP-маршрутизация](/ru/web/router)