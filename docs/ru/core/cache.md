# Кэш

Соберите **CacheService**: выберите адаптер memory / file / Redis, читайте и пишите через `this.cache`, пройдите цепочку login **session** (token → данные пользователя) — выдача token, чтение при авторизации, удаление при выходе.

В подклассе реализуйте `createAdapter()`; бизнес-префиксы собирайте в `CacheKey` через `protected readonly` и `this.key(...)`, в методах дальше цепляйте `.key(token)`, чтобы строки не разъезжались.

```typescript
import { BaseCacheService } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService { // [!code focus:28]
  protected readonly loginTokenKey = this.key('login-token', 'v1');

  protected createAdapter() {
    return new CacheMemoryAdapter(); // [!code highlight]
  }

  async getLoginToken(token: string) {
    return this.cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await this.cache.set(
      this.loginTokenKey.key(token),
      session,
      '7 days',
    );
  }

  async deleteLoginToken(token: string) {
    await this.cache.delete(this.loginTokenKey.key(token));
  }
}
```

`get` / `set` / `delete` и др. принимают **строку или `CacheKey`**. С дженериком у `get<T>(key)` возврат типизируется как `T | null`; срок у `set` / `setNX` / `expire` и у `duration` в `@remember` — это **`DurationInput`**: миллисекунды или читаемые строки (`'7 days'`, `'30m'`, `'1.5 hours'`) — см. ниже. Имена и параметры `services.cache.xxx` совпадают с объявлением в CacheService; смена сигнатуры заставит компилятор пройтись по маршрутам и колбэкам авторизации.

Регистрация и прогрев (в проде при переходе на Redis особенно нужен `eager`):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
В проде или при нескольких инстансах, если cache не в `eager`, первое чтение кэша платит за подключение к Redis, и хвостовая задержка может подскочить.
:::

## Чтение и запись session

После выдачи token при логине запишите в кэш «token → данные пользователя»; в `onLoaded` авторизации прочитайте; при выходе — `delete`. Имена ключей — с версионным префиксом `CacheKey`; при смене структуры сессии на релизе меняете одно место и инвалидируете пакет.

Со стороны бизнес-логики (логин / auth / выход):

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

Выдачу token и запросы к БД оставляйте в User / Auth; CacheService только хранит и отдаёт.

## Выбор адаптера

Адаптер решает, где лежат данные: **memory** — без зависимостей, в процессе, сброс при рестарте, для локалки и тестов; **Redis** — общий session и счётчики лимитов между инстансами; **file** — лёгкая дисковая персистенция. В бизнес-коде обычно меняют только `createAdapter()`; API чтения/записи тот же.

Локально и в тестах — `@aomex/cache/memory`, без зависимостей, данные теряются при рестарте:

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

Прод или несколько инстансов с общим session / rate limit — `@aomex/cache-redis-adapter` (`ioredis` в пакете; чаще всего меняют только `createAdapter()`):

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

На одной машине с лёгкой персистенцией — `@aomex/cache/file`.

## Сборка ключей: CacheKey

`this.key(...)` возвращает **`CacheKey`**, а не обычную строку: сегменты склеиваются через `:`, можно продолжать `.key` / `.keyHash` / `.toHash()`. `this.cache.get` / `set` и т.д. принимают его напрямую — `String(...)` не нужен.

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| Запись | Результат |
| --- | --- |
| `this.key('a', 1)` | Читаемый ключ `a:1` |
| `prefix.key(id)` | Ещё один сегмент после префикса `CacheKey` |
| `this.key('a').keyHash(id)` | Префикс остаётся, **хешируется только этот аргумент** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **Весь** ключ MD5, без читаемого префикса |

Хешируйте, если сегмент длинный, с «странными» символами или не хотите plain text в Redis; для повседневных ключей читаемый префикс упрощает разбор. Отдельный `hash()` убран — используйте варианты выше.

### Префиксы и версии

`protected readonly` поля собирают бизнес-префиксы (например `login-token`); в методах цепляйте `.key(token)` / `.key(id)`, не разбрасывайте магические строки. Версия в префиксе (`v1` → `v2`) **без конфликта имён** списывает старые session:

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## Длительность DurationInput

Срок не обязательно писать как `60_000`. `set` / `setNX` / `expire` и `duration` у `@remember` принимают:

- **number**: миллисекунды (как раньше)
- **строка**: число + единица, пробел по желанию — `'30m'`, `'1 hour'`, `'7 days'`

Частые единицы: `ms` / `s` (`sec` / `second`) / `m` (`min` / `minute`) / `h` (`hr` / `hour`) / `d` (`day`) / `w` (`week`) / `month` / `y` (`year`). `month` — 30 дней, `year` — 365. В других местах можно `import { parseDuration } from '@aomex/common'`.

```typescript
await this.cache.set(key, session, '7 days');
await this.cache.setNX(lockKey, '1', '30 seconds');
await this.cache.expire(key, '1 hour');
```

## exists: только наличие

Когда нужно лишь узнать, **есть ли** ключ, без чтения и декодирования значения, используй `exists`. Возвращает `boolean`, принимает строку или `CacheKey`.

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // сессия ещё есть — решать, нужен ли get
}
```

Отличие от `get`: при промахе `get` даёт `null` (сам решаешь, что это значит) и десериализует значение; `exists` только спрашивает адаптер, остался ли ключ. Подходит для меток-заглушек, проверки, что замок ещё удерживается, или разведки перед вытягиванием большого объекта.

::: tip
Между «сначала exists, потом get» другой процесс может удалить или изменить ключ — не используй это как строгое транзакционное условие. Захват замка и идемпотентность по-прежнему через `setNX` ниже.
:::

## setNX и счётчики

`setNX` пишет, только если ключа нет — распределённые замки, идемпотентное «обработать один раз». TTL должен покрывать худшее время задачи, иначе после истечения замок может забрать другой worker. `increment` / `expire` — для счётчиков ошибок кода, скользящих окон.

Замок, идемпотентность (TTL больше худшего времени задачи):

```typescript
const ok = await this.cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

Ошибки кода: сначала `increment`, при первом срабатывании (или если TTL ещё нет) — `expire` на окно; как привычка Redis `INCR`. В memory-адаптере `increment` / `decrement` **сохраняют текущий TTL**, смена числа не сбрасывает срок.

```typescript
const key = this.key('otp-fail', phone);
const n = await this.cache.increment(key);
if (n === 1 || (await this.cache.ttl(key)) === -1) {
  await this.cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## Декоратор кэша

Повторять в каждом методе «get → промах → вычислить → set» утомительно, при параллельных запросах с одним ключом вычисление дублируется. `createRemember` даёт декоратор метода `@remember`: при попадании — сразу ответ; при промахе — только исходный метод и запись; **при конкуренции по одному ключу выполняется один вызов**, остальные ждут результат.

Декоратор привязывайте к **своему** классу кэш-сервиса — передайте **конструктор подкласса** `BaseCacheService` (не базовый класс, не экземпляр). Удобнее всего в `cache.service.ts`; в бизнес-коде импортируйте `remember`:

```typescript
import { BaseCacheService, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export default class CacheService extends BaseCacheService {
  protected createAdapter() {
    return new CacheMemoryAdapter();
  }
}

export const remember = createRemember(CacheService); // [!code highlight]
```

После подключения адаптера в `onInit` у `BaseCacheService` remember вешается сам и снимается при остановке — **ручная регистрация не нужна**. В `combineServices` по-прежнему стоит `eager: ['cache']`: пока кэш не готов, декорированные методы **ждут**; после shutdown вызов **бросает ошибку**.

### На бизнес-методы

Метод должен быть **async** (возвращать `Promise`). Одна длительность — «сколько держать в кэше» (`DurationInput`):

```typescript
import { Service } from '@aomex/common';
import { remember } from './cache.service.js';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

Чтобы задать ключ или значение по умолчанию, передай объект. Тогда первый `await services.report.find(1)` идёт в БД; повтор с теми же аргументами в окне читает кэш. `duration` — срок после записи:

```typescript
class ReportService extends Service {
  @remember({ // [!code focus:8]
    duration: '1 minute',
    key: (id) => {
      return `report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

| Форма | Назначение |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | Только срок; ключ по умолчанию |
| `duration` | Обязательно (объектная форма); срок кэша |
| `key: 'фиксированная строка'` | Один ключ на весь метод (без аргументов, один результат на сайт) |
| `key: (...args) => string` | Ключ из аргументов; `this` — экземпляр сервиса |
| `defaultValue` | Когда исходный метод вернул `null`, наружу это значение (по умолчанию `null`) |

### Сборка ключа по умолчанию

Без `key` фреймворк использует:

`имя класса или displayName` + `-` + `имя метода` + `-` + `JSON.stringify(аргументы)`

При наследовании `Service` и имени на `Service` берётся `displayName` без суффикса (`ReportService` → `Report`). Аргументы идут в JSON — **не передавайте не сериализуемое или «прыгающее»** (`Date`, циклы, каждый раз новый объект), иначе ключи не совпадут и кэша по сути не будет. При сложных аргументах свой `key` надёжнее.

### Конкуренция и пустые результаты

При одновременных запросах с одним ключом первый через `setNX` занимает слот и выполняет метод; слот ~20 с, продлевается на время выполнения; остальные поллят до снятия слота, затем читают кэш (или `defaultValue`). Это от пробоя кэша, а не универсальный распределённый замок — не используйте как общий lock.

Если исходный метод вернул `null`, **`null` не пишется** (чтобы «нет данных» не застывало надолго); снаружи видят `defaultValue`. Чтобы закэшировать явное «нет», продумайте ключи сами или пишите `this.cache.set` вручную.

### Несколько кэшей

Локальный memory и общий Redis: по подклассу `BaseCacheService` и по вызову `createRemember`. Область — **класс сервиса**; `fork()` нет. Какой `remember` повесили — в то хранилище и попадёте.

::: warning
Вешайте только на **чтение-частые, редко меняющиеся** запросы, где краткая устарелость допустима. Не на методы с побочными эффектами — запись в БД, SMS, списание склада — в кэше останется старое. При изменении данных сами `cache.delete` по ключу или поднимите версию ключа (см. сборку ключей выше).
:::

## Дальше

- Регистрация сервисов и `eager`: [Сервисный слой](/ru/core/service)
- `store` для счётчиков abuse: [Защита от злоупотреблений](/ru/plugins/abuse)
- Session в авторизации: [Единая точка Auth](/ru/plugins/auth)
- Bearer и стратегии token: [Стратегия Bearer](/ru/plugins/auth-bearer-strategy)