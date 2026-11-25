---
outline: deep
---

# Защита от злоупотреблений

Сканирование каталогов, удары по honeypot, короткие всплески 404, фейковые token на logout — это чаще разведка границ, а не «обычное превышение». `@aomex/abuse` **считает** по стратегиям и при лимите **блокирует IP** (или вызывает вас, чтобы забанить аккаунт). Дополняет [ограничение частоты](/ru/plugins/rate-limit): лимит гасит всплески QPS, abuse ловит зонды и злоупотребления, о которых сообщает бизнес.

Счётчики и состояние блокировки живут на адаптере `@aomex/cache` (memory / Redis и т.д.). Для нескольких инстансов — Redis. Зависит от `ctx.request.ip`: в проде задайте `proxyIP: { mode: 'detect' }` (или фиксированную цепочку доверия), иначе весь сайт может видеть только IP обратного прокси.

```bash
pnpm add @aomex/abuse
# 还需已有的 @aomex/cache（及生产用的 Redis 适配器）
```

## Создать и повесить `.web()`

`new Abuse(...)` возвращает **сервис** (API вроде `ipAbuse` / `blockIP`), а не middleware, который сразу кладут в `mount`. На HTTP используйте `.web()` в `WebApp.mount`. В бизнес-коде вызывайте API того же экземпляра `abuse` — на **`ctx` он не появляется**.

Ниже сначала две частые стратегии: honeypot-пути (один удар → блок) и накопление кодов ошибок (короткий всплеск 401 / 404 → блок).

```typescript
import { Abuse } from '@aomex/abuse';
import { Caching } from '@aomex/cache';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const cache = new Caching(new CacheMemoryAdapter());

const abuse = new Abuse({ // [!code focus:18]
  store: cache,
  strategies: [
    {
      strategy: 'honeypot',
      paths: ['/.env', '/wp-admin/**'],
      limit: 1,
      window: '1 hour',
      blockFor: '1 month',
    },
    {
      strategy: 'http-error',
      statusCodes: [401, 404],
      limit: 30,
      window: '10 minutes',
      blockFor: '1 week',
    },
  ],
});

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse.web(), routers('./src/routers')], // [!code highlight]
});
```

Локально / в тестах — memory; в проде с несколькими репликами передайте Redis-адаптер как `store`, иначе блокировка останется на одной машине. `window` / `blockFor` принимают миллисекунды или читаемые строки (`'1 hour'`, `'30m'`) — тот же `DurationInput`, что у [кэша](/ru/core/cache#длительность-durationinput).

При запросе: IP уже заблокирован → по умолчанию **403**; honeypot на лимите → блок и 403 сразу. `http-error` считает после ответа — **тот запрос всё ещё возвращает исходный статус**; следующий уже получит 403.

На WebSocket тот же `abuse` вешают через `.socket()` (event-honeypot и т.д.) — см. [Защита от злоупотреблений (WebSocket)](/ru/websocket/abuse); эта страница не повторяет.

## Honeypot-пути

Намеренно оставьте пути, которые обычный пользователь не трогает (`/.env`, `/wp-admin/**` и т.д.). Попадания считают по IP; на лимите IP блокируется. Строки путей — точное совпадение и простой glob; можно передать regex. Regex проверяет `pathname + search`, удобно ловить зонды с странным query. `methods` необязателен; без него метод не важен.

```typescript
{
  strategy: 'honeypot',
  paths: ['/.env', '/.env*', '/.git/**', '/wp-*.php', /^\/admin\?.*dump=/],
  methods: ['GET'],
  limit: 1,
  window: '1 hour',
  blockFor: '1 day',
}
```

Справка по шаблонам:

| Запись | Что совпадает |
| --- | --- |
| Точная строка (без `*`) | Полное равенство pathname — `'/.env'` не ловит `'/.env.local'` |
| `*` | Любые символы **внутри одного сегмента**, **без** `/`. `'/wp-*.php'` ловит `/wp-login.php`, не `/wp/admin.php` |
| `**` | **Через сегменты**. `'/a/**/c'` ловит `/a/b/d/c`, не `/a/c` (между ними хотя бы один сегмент) |
| Хвост `/**` | Сама директория + любая глубина детей. `'/.git/**'` ловит `/.git` и `/.git/config`, не `/.github` |
| `RegExp` | Тестирует `pathname + search`, например `/^\/admin\?.*dump=/` |

Glob смотрит только pathname — query не влияет; query вместе нужны — берите regex. `paths` не может быть пустым; это проверяется при создании. Brace-расширения и т.п. нет — матчятся как литералы.

## Накопление кодов ошибок

Короткий шквал 404 / 401 часто значит сканирование API или подбор учётных данных. Используйте `http-error`: несколько `statusCodes` в одной стратегии **делят один счётчик**. Можно сузить `paths` / `methods`; без них считается этот статус по всему сайту.

```typescript
{
  strategy: 'http-error',
  statusCodes: [404],
  paths: ['/api/**'],
  limit: 50,
  window: '15 minutes',
  blockFor: '2 hours',
}
```

Хорошо против сканеров API. Если 401 на логине тоже хотите жёстко контролировать — повесьте отдельную стратегию с `paths`, не смешивайте с общесайтовым 404 в одном бакете.

## Бизнес-отчёт: зонды с фейковым token

Ответ сам по себе может быть успехом (например logout всегда 204, есть token или нет), но по IP всё равно нужно считать «подозрительные попытки». Тогда `ip-abuse` + вызов из маршрута. `reason` — строка; должна совпадать с объявлением в стратегии; неизвестный reason бросает в рантайме. Один reason — одна стратегия.

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'ip-abuse',
      reason: 'logout-miss',
      limit: 5,
      window: '1 hour',
      blockFor: '6 hours',
    },
  ],
});

router.post('/logout', {
  action: async (ctx) => {
    const hit = await services.user.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

Когда reason’ов становится много, TypeScript `enum` (строковые или числовые члены) собирает магические строки. Передавайте члены enum и в стратегиях, и в `ipAbuse`; второй аргумент сужается до членов, встречающихся в стратегиях — незаявленные члены и голый `'logout-miss'` режет тип.

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies 里：reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

## Бизнес-отчёт: измерение аккаунта

Злоупотребления на уровне аккаунта (фарм купонов, пользовательское измерение после брутфорса) — `user-abuse`. Пакет **не пишет в вашу пользовательскую БД**: на лимите только вызывает `onBanUser`; в колбэке вы обновляете БД и сбрасываете session. Если есть хоть одна стратегия `user-abuse`, **`onBanUser` обязателен** и проверяется при создании. `reason` — строка или enum.

```typescript
const abuse = new Abuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // 建议封禁时长，经回调传出
    },
  ],
  onBanUser: async (id, reason, detail) => { // [!code focus:6]
    await db.user.update({
      where: { id: Number(id) },
      data: { bannedUntil: new Date(Date.now() + (detail.banFor ?? 0)) },
    });
  },
});

await abuse.userAbuse(userId, 'order-probe');
```

С enum паттерн как у IP: в стратегиях `UserAbuseReason.OrderProbe`; отчёт и `reason` у `onBanUser` сужаются до этих членов. Числовой enum (`OrderProbe = 1`) тоже можно; перед сохранением вызывается `String(reason)`, ключи бакетов — строковые формы.

В `detail` есть `count` / `limit` и `banFor` в миллисекундах (`undefined`, если стратегия не задала). Для одного пользователя + reason `onBanUser` успешно срабатывает не чаще одного раза в окне (кэш-плейсхолдер гасит гонки); если колбэк бросает, плейсхолдер снимается и окно можно повторить.

## Обход health-check и ручные блокировки

Пути зондов не должны упираться в логику блокировки: передайте `bypass` в `.web()`. Временно заблокировать / разблокировать IP — `blockIP` / `unblockIP`; запрос статуса — `isIPBlocked`. Для аудита повесьте `onBlockIP` — срабатывание стратегии, лимит `ipAbuse` и ручной `blockIP` все заходят в колбэк.

При блоке по умолчанию **403**; чтобы выровнять семантику с rate-limit (например 429), передайте `blockedError`.

```typescript
import { logger } from '@/services/logger.service';

const abuse = new Abuse({
  store,
  strategies: [/* ... */],
  onBlockIP: async (ip, reason, detail) => {
    await logger.withBindings({ ip, reason, ...detail }, async () => {
      logger.warn('abuse.block');
    });
  },
});

mount: [
  abuse.web({ // [!code focus:6]
    bypass: (ctx) => {
      return ctx.request.pathname === '/health';
    },
    blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  }),
  routers('./src/routers'),
],

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

На HTTP стороне `reason` у `onBlockIP` часто `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`; если на том же инстансе висит WebSocket event-honeypot, появится и `'socket-events'` (см. [Защита от злоупотреблений (WebSocket)](/ru/websocket/abuse)). `detail.blockFor` — миллисекунды; повторный `blockIP` на уже заблокированный IP пропускается (TTL не обновляется, колбэк не дублируется).

::: tip
Блокировки abuse — скорее «поймали — посидите»; мягкий общесайтовый throttle всё ещё в [ограничении частоты](/ru/plugins/rate-limit). Можно вешать оба: лимит впереди гасит шипы, abuse копит по стратегиям и потом блокирует.
:::

## Связанное

- [Ограничение частоты](/ru/plugins/rate-limit)
- [Защита от злоупотреблений (WebSocket)](/ru/websocket/abuse)
- [Кэш](/ru/core/cache) (адаптеры `store` и `DurationInput`)
- [Защита CSRF](/ru/plugins/csrf)
