# Кэш

В корне композиции — один общий **`Caching`**: выберите адаптер memory / file / Redis и передайте **тот же экземпляр** в бизнес-код и плагины auth / abuse / OAuth (в конфиге часто `store`). Прогоните цепочку login **session** (token → данные пользователя): выдача, чтение при auth, удаление при выходе.

Имя класса оставьте `Caching`, не `Cache` — чтобы не столкнуться с глобальным `Cache` DOM / Web Cache API. Переменную экземпляра зовите `cache`. Первое чтение/запись — ленивое подключение; при остановке — отключение через внутренний `registerLifecycle`.

`src/cache.ts` **экспортирует только** `cache` и `remember`; сессии и префиксы ключей — в своих Service, импорт `cache` отсюда.

```typescript
// src/cache.ts
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter()); // [!code highlight]
export const remember = createRemember(cache);
```

`get` / `set` / `delete` / `getAndDelete` / `singleFlight` и т.д. принимают **строку или `CacheKey`**. С generic `get<T>(key)` тип результата — `T | null`; TTL в `set` / `setNX` / `expire` — **`DurationInput`**: миллисекунды или строки вроде `'7 days'`, `'30m'`, `'1.5 hours'`, см. ниже.

В плагины — тот же экземпляр:

```typescript
import { cache } from '@/cache';

new Abuse({ store: cache, strategies: [/* … */] });
new AuthSessionStrategy({ store: cache, /* … */ });
new OAuth2Client({ store: cache, /* … */ });
```

::: tip
Не создавайте `new Caching(adapter)` в каждом плагине — один раз в корне и делите. Второй экземпляр только при двух хранилищах (локальный memory + общий Redis), у каждого свой `createRemember`.
:::

## Чтение и запись session

После login сохраните «token → пользователь» в кэше; в `onLoaded` auth прочитайте; при logout — `delete`. Имя ключа — префикс `CacheKey` с версией: при смене структуры сессии в релизе меняете одно место и инвалидируете пачку. Методы — в User / Auth Service:

```typescript
// src/services/user.service.ts
import { Service } from '@aomex/common';
import { cache } from '@/cache';

export default class UserService extends Service {
  protected readonly loginTokenKey = cache.key('login-token', 'v1'); // [!code highlight]

  async getLoginToken(token: string) {
    return cache.get<{ userId: number; role: number }>(
      this.loginTokenKey.key(token),
    );
  }

  async setLoginToken(
    token: string,
    session: { userId: number; role: number },
  ) {
    await cache.set(this.loginTokenKey.key(token), session, '7 days');
  }

  async deleteLoginToken(token: string) {
    return cache.delete(this.loginTokenKey.key(token));
  }
}
```

Со стороны бизнеса (login / auth / logout):

```typescript
// 登录成功后写入
const token = auth.strategy('bearer').signature('sha256', user.id);
await services.user.setLoginToken(token, {
  userId: user.id,
  role: user.role,
}); // [!code highlight]

// 鉴权 onLoaded 里读取
const session = await services.user.getLoginToken(token);
if (!session) {
  return false;
}

// 退出登录删掉
await services.user.deleteLoginToken(token);
```

## Выбор адаптера

Адаптер решает, где лежат данные: **memory** — без зависимостей, в процессе, пропадает при рестарте (локально и в тестах); **Redis** — общий session и счётчики rate limit при нескольких инстансах; **file** — лёгкая персистенция на одной машине. В бизнес-коде обычно меняют только адаптер при создании, API чтения/записи то же.

Локально и в тестах — `@aomex/cache/memory`:

```typescript
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
```

Прод или несколько инстансов — `@aomex/cache-redis-adapter` (`ioredis` в пакете):

```typescript
import { Caching } from '@aomex/cache';
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

export const cache = new Caching(
  new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }),
);
```

На одной машине с диском — `@aomex/cache/file`.

## Как собирать ключ: CacheKey

`cache.key(...)` (или статический `CacheKey.key(...)`) возвращает **`CacheKey`**, не строку: части склеиваются `:`, дальше `.key` / `.keyHash` / `.toHash()`. `cache.get` / `set` принимают его без `String(...)`.

```typescript
cache.key('user', 1); // user:1
cache.key('user').key(1); // 同上
cache.key('user').keyHash(1); // user:<md5('1')>，前缀可读
cache.key('user', 1).toHash(); // <md5('user:1')>
cache.keyHash('user', 1); // 同上，整键哈希
```

| Запись | Что получаете |
| --- | --- |
| `cache.key('a', 1)` | читаемый ключ `a:1` |
| `prefix.key(id)` | ещё сегмент к существующему префиксу `CacheKey` |
| `cache.key('a').keyHash(id)` | префикс виден, **хешируется только аргумент** |
| `cache.key(...).toHash()` / `cache.keyHash(...)` | **весь** ключ MD5, без читаемого префикса |

Хеш — для длинных кусков, странных символов, когда не хотите plaintext в Redis; для обычных бизнес-ключей читаемый префикс проще отлаживать. Старый отдельный `hash()` убран — только варианты выше.

### Префикс и версия

В Service держите префиксы в `protected readonly` (например `login-token`), в методах `.key(token)` / `.key(id)` — не размазывайте магические строки. Версия в префиксе (`v1` → `v2`) — **без коллизий** инвалидирует старые session:

```typescript
protected readonly loginTokenKey = cache.key('login-token', 'v2');
```

## Длительность DurationInput

Не обязательно писать `60_000` вручную. `set` / `setNX` / `expire` и `duration` у `@remember` принимают:

- **number** — миллисекунды (как раньше)
- **string** — число + единица, пробел опционален: `'30m'`, `'1 hour'`, `'7 days'`

Единицы: `ms` / `s` (`sec` / `second`) / `m` (`min` / `minute`) / `h` (`hr` / `hour`) / `d` (`day`) / `w` (`week`) / `month` / `y` (`year`). `month` = 30 дней, `year` = 365. Или `import { parseDuration } from '@aomex/common'` где нужно ms.

```typescript
await cache.set(key, session, '7 days');
await cache.setNX(lockKey, '1', '30 seconds');
await cache.expire(key, '1 hour');
```

## exists: только «есть ли ключ»

Когда нужно знать **наличие**, без десериализации значения — `exists`. Возвращает `boolean`, строка или `CacheKey`.

```typescript
const key = loginTokenKey.key(token);
if (await cache.exists(key)) {
  // 会话还在，再决定要不要 get 详情
}
```

Отличие от `get`: промах — `null` и полная десериализация; `exists` спрашивает адаптер «ключ ещё жив?». Маркеры, удержание lock, разведка перед тяжёлым `get`.

::: tip
Между exists и get ключ могут удалить или изменить — не как строгое транзакционное условие. Lock и идемпотентность — `setNX` ниже; одноразовое потребление — `getAndDelete`.
:::

## getAndDelete: прочитал и удалил

Как Redis `GETDEL` для одноразовых токенов — `getAndDelete`: атомарно взять и удалить. При двух параллельных вызовах значение получит только один, у другого `null` (или ваш default).

Типично: OAuth `state`, код из письма, короткий download ticket — прочитали — обязали инвалидировать, без replay.

```typescript
const ticket = await cache.getAndDelete<{ userId: number }>(
  cache.key('email-verify', code),
);
if (!ticket) {
  ctx.throw(400, '验证码无效或已使用');
}
// ticket.userId 可用；键已不在缓存里
```

В отличие от `get` затем `delete`: между шагами ключ ещё читается; `getAndDelete` — один проход в адаптере. Второй аргумент — default при промахе (тип как у `get`).

## setNX и счётчики

`setNX` пишет, если ключа нет — распределённый lock, идемпотентность «обработать один раз». TTL должен перекрывать худшее время задачи, иначе после истечения lock возьмёт другой worker. `increment` / `expire` — ошибки OTP, счётчики в фиксированном окне.

Lock / идемпотентность (TTL > худшего времени):

```typescript
const ok = await cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

Ошибки OTP: `increment`, при первом (или без TTL) — `expire` на окно — как привычка Redis `INCR`. В memory-адаптере incr/decr **сохраняют TTL**, сброс срока от смены числа нет.

```typescript
const key = cache.key('otp-fail', phone);
const n = await cache.increment(key);
if (n === 1 || (await cache.ttl(key)) === -1) {
  await cache.expire(key, '15 minutes'); // [!code highlight]
}
if (n > 5) {
  ctx.throw(429);
}
```

## singleFlight: при параллели считать один раз

Много запросов на один ключ хотят «посчитать сейчас» (JWKS, дорогой API), без долгого кэша — `singleFlight`: первый идёт в `factory`, остальные ждут общий результат; **после полёта долгого кэша нет**, следующий вызов снова считает.

```typescript
async function loadJwks() {
  return cache.singleFlight(cache.key('jwks'), async () => { // [!code focus:3]
    return fetchJwksFromIdp();
  });
}
```

Разделение с `@remember`: `remember` = singleFlight + **запись на `duration`**; `singleFlight` = **только общий расчёт в этой волне**. Lock ~30s с продлением при работе; при ошибке ждущие видят ту же ошибку. Если исполнитель упал без результата — ждущие соревнуются снова (с лимитом раундов).

::: tip
При нескольких инстансах ключ должен быть на общем адаптере (Redis) — иначе singleFlight только внутри процесса; локальный memory — только этот процесс.
:::

## Декоратор кэша

Повторять в методах «get → нет → считать → set» утомительно; при параллели на один ключ считают многократно. `createRemember` даёт декоратор `@remember`: hit — сразу ответ; miss — метод и запись; **на один ключ в полёте один исполнитель**, остальные ждут (placeholder lock как у singleFlight, ~30s с продлением).

Декоратор привязан к **конкретному `Caching`** — `createRemember(cache)`, не адаптер и не класс. Экспорт из `cache.ts`, в Service импорт `remember`:

```typescript
import { Caching, createRemember } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';

export const cache = new Caching(new CacheMemoryAdapter());
export const remember = createRemember(cache); // [!code highlight]
```

Подключение — ленивая загрузка `Caching`.

### На бизнес-методы

Метод должен быть **async** (Promise). Только длительность — «сколько кэшировать» (`DurationInput`):

```typescript
import { Service } from '@aomex/common';
import { remember } from '@/cache';

class ReportService extends Service {
  @remember('1 minute')
  async build(id: number) {
    return heavyCompute(id);
  }
}
```

Свой `key` или `defaultValue` — объектом; первый `await services.report.find(1)` идёт в БД, в окне с теми же аргументами — из кэша. `duration` — срок после записи:

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

| Запись | Назначение |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | только TTL; ключ по умолчанию |
| `duration` | обязателен в объектной форме; как долго хранить |
| `key: 'строка'` | один ключ на весь метод (без аргументов, глобальный результат) |
| `key: (...args) => string` | ключ из аргументов; `this` — экземпляр сервиса |
| `defaultValue` | если метод вернул `null`, наружу это значение (по умолчанию `null`) |

### Ключ по умолчанию

Без `key` фреймворк собирает:

`имя класса или displayName` + `-` + `имя метода` + `-` + `JSON.stringify(аргументы)`

Для наследников `Service` с именем на `Service` — `displayName` без суффикса (`ReportService` → `Report`). Аргументы в JSON — **не кладите несериализуемое или «дрожащее»** (`Date`, циклы, каждый раз новый объект), иначе ключ не совпадёт. Много аргументов или хаос — свой `key` надёжнее.

### Параллель и пустой результат

На один ключ параллельно: первый ставит placeholder через `setNX` и гоняет метод (~30s, продление при работе); остальные ждут снятия placeholder и читают кэш (или `defaultValue`). Это против cache stampede, не семантика распределённого lock — не универсальная блокировка. «Только общий расчёт в этой волне, без долгого кэша» — `singleFlight` выше.

Если метод вернул `null`, **`null` в кэш не пишется** (чтобы не зацементировать «нет»); снаружи — `defaultValue`. Кэшировать явное «ничего» — свой ключ или ручной `cache.set`.

### Несколько кэшей

Локальный memory и общий Redis: по `new Caching(adapter)` и свой `createRemember`. Область — **экземпляр**, без `fork()`. Какой `remember` на методе — в то хранилище.

::: warning
Вешайте только на **часто читаемые, редко пишущиеся запросы с коротким TTL**. Не на запись в БД, SMS, списание склада — в кэше останется старое. После изменений данных — `cache.delete` или смена версии ключа (см. «Как собирать ключ»).
:::

## Дальше

- Регистрация сервисов и lifecycle: [слой сервисов](/ru/core/service)
- OAuth `state` и `store`: [OAuth2-клиент](/ru/plugins/oauth2-client)
- `store` для abuse-счётчиков: [защита от злоупотреблений](/ru/plugins/abuse)
- session в auth: [единая точка Auth](/ru/plugins/auth)
- Bearer и token: [стратегия Bearer](/ru/plugins/auth-bearer-strategy)