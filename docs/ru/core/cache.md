# Кэш

Создайте **CacheService**: выберите адаптер памяти/файла/Redis, используйте this.cache для чтения и записи; используйте вход **session** (токен → информация о пользователе), чтобы пройти всю цепочку «подпись, чтение аутентификации, удаление выхода».

Подклассы реализуют createAdapter(); бизнес-ключи управляются централизованно с помощью protected readonly + this.concat, чтобы избежать разбросанных строк.

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.concat('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.concat(this.loginTokenKey, token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.concat(this.loginTokenKey, token),
      session,
      this.ttl.DAY * 7,
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.concat(this.loginTokenKey, token));
  }
}
```

` get<T>(key)`После добавления дженериков тип возвращаемого значения будет ` T | null`;Третий параметр set — срок действия** миллисекунды**,` this.ttl.DAY `,` this.ttl.MINUTE `Используется для записи меньшего количества магических чисел.` services.cache.xxx `Имя и параметры метода соответствуют тому, что вы объявили в CacheService. При изменении подписи компилятор будет следить за изменениями обратного вызова маршрутизации и аутентификации.

Зарегистрируйтесь и прогрейтесь (особенно рекомендуется при замене Redis в продакшене):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
При создании или наличии нескольких экземпляров кеш не требует активной записи, и первый запрос на чтение кеша все равно должен платить за время подключения к Redis, а хвостовая задержка подвержена дрожанию.
:::

## сеанс чтения и записи

После входа в систему для выдачи токена пропишите в кэш «токен → информация о пользователе»; прочитайте его обратно при аутентификации onLoaded; удалите его при выходе. Для имени ключа ` this.concat`Добавьте префикс версии, и при изменении структуры сеанса весь пакет станет недействительным из-за изменения только одного местоположения.

Бизнес-сторона (вход/аутентификация/выход):

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.cache.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.cache.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.cache.deleteLoginToken(token);
```

Логика, такая как выдача токенов и проверка баз данных, остается в таких службах, как User/Auth; CacheService отвечает только за доступ.

## память и Redis

Адаптер определяет, куда попадают данные: **память**, нулевая зависимость, в процессе, перезапуск и очистка, подходит для локального и одиночного тестирования; **Redis** общий сеанс с несколькими экземплярами, текущий лимит; если вам нужно какое-то сохранение диска, см. **файл**. Бизнес-код обычно меняется только ` createAdapter()`, API чтения и записи остается неизменным.

Локальная разработка и одиночное тестирование используют @aomex/cache/memory, никаких зависимостей и данные будут потеряны после перезапуска:

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

Если для одной машины требуется некоторое постоянство, вы можете выбрать @aomex/cache/file.

## название и версия ключа

` protected readonly `Бизнес-префикс набора полей (например,` login-token `),` this.concat `Запишите токен или идентификатор, чтобы избежать разбросанных по методу магических строк. Впишите номер версии в префикс (` v1`→` v2`) эквивалентно **удалению старого сеанса без повторяющихся имен, что обычно используется при выпуске версий и изменении загрузки.

Изменение v1 → v2 означает, что весь пакет ключей становится недействительным. Это обычно используется при выпуске версий и смене сеансов:

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```

Не засоряйте строки версии в различных методах, используйте в классе префикс readonly + this.concat.

## setNX и подсчет

` setNX `Написано, когда ключ не существует, используется для распределенных блокировок и идемпотентной «обработки только один раз»; TTL должен охватывать худшее время выполнения задачи, иначе блокировка может быть украдена вторым исполнителем после истечения срока ее действия.` increment `/` expire `Подходит для подсчета количества ошибок проверочного кода и скользящих окон.

Захват блокировки, идемпотентный (TTL должен быть больше худшего времени задачи):

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```

Используйте инкремент/истек срок действия для подсчета количества окон, например количества ошибок кода проверки.

## Декоратор метода @remember

Для запросов, которые читают больше и пишут меньше, и результаты могут временно кэшироваться, если вы не хотите вручную писать get → Miss → set для каждого элемента, повесьте трубку на методе **Business Service**. `@remember`. Сначала в CacheService.onInit ` remember.setInstance(this)`и сотрудничать с ` eager: ['cache']`, при выключении ` deleteInstance`.

```typescript
protected override async onInit() {
  await super.onInit();
  remember.setInstance(this); // [!code highlight]
}

protected override async onDestroy() {
  remember.deleteInstance(); // [!code highlight]
  await super.onDestroy();
}
```

```typescript
class ReportService extends Service {
  @remember(60_000)
  async build(id: number) {
    return heavyCompute(id);
  }

  @remember({ // [!code highlight]
    duration: 60_000,
    key: (id) => {
      return ` report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

::: warning
Не добавляйте операции записи, имеющие побочные эффекты; если они не сработают, вам все равно придется удалить их самостоятельно или изменить версию ключа. @remember будет кэшировать старые результаты при использовании в методах, изменяющих данные, поэтому вам необходимо разработать собственную стратегию аннулирования.
:::

## Дальше

- Регистрация услуги с помощью нетерпеливого: [Услуги](/ru/core/service)
- Как использовать сеанс при аутентификации: [Аутентификация](/ru/plugins/auth)
- Стратегия носителя и токена: [Стратегия носителя](/ru/plugins/auth-bearer-strategy)