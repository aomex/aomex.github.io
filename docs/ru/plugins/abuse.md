---
outline: deep
---

# Защита от злоупотреблений

Скан каталогов, срабатывание honeypot, всплеск 404, фальшивые token при logout — это часто не «обычный перегруз», а разведка границ. `@aomex/abuse` **считает** по стратегиям и при лимите **блокирует IP** (или зовёт вас забанить аккаунт). Дополняет [ограничение частоты](/ru/plugins/rate-limit): лимит гасит всплески QPS, abuse — зондирование и злой умысел с бизнес-стороны.

Счётчики и блокировки лежат на адаптере `@aomex/cache` (memory / Redis и т.д.). В кластере — общий Redis. Опирается на `ctx.request.ip`; в проде задай `proxyIP: { mode: 'detect' }` (или доверенную цепочку), иначе все запросы могут выглядеть как IP прокси.

```bash
pnpm add @aomex/abuse
# также нужен @aomex/cache (в проде — Redis-адаптер)
```

## Подключить middleware

`createAbuse` возвращает объект, который **одновременно middleware и API** (`userAbuse` / `ipAbuse` / `blockIP` …) — **не** вешается на `ctx`. Создай экземпляр, смонтируй, вызывай тот же объект из маршрутов и сервисов.

```typescript
import { createAbuse } from '@aomex/abuse';
import { CacheMemoryAdapter } from '@aomex/cache/memory';
import { routers, WebApp } from '@aomex/web';

const abuse = createAbuse({ // [!code focus:18]
  store: new CacheMemoryAdapter(),
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
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [abuse, routers('./src/routers')], // [!code highlight]
});
```

Локально / в тестах — memory; в проде с несколькими репликами подставь Redis-адаптер в `store`, иначе блок только на одной ноде. `window` / `blockFor` и прочие интервалы — миллисекунды или строки вроде `'1 hour'`, `'30m'` — тот же `DurationInput`, что в [кэше](/ru/core/cache#длительность-durationinput).

На запрос: IP уже заблокирован → по умолчанию **403**; honeypot достиг лимита → блок и 403 сразу. `http-error` считает после ответа — **запрос, перешагнувший лимит, ещё отдаёт исходный статус**, 403 только со следующего.

## Четыре стратегии

| Стратегия | Что накапливается | При лимите |
| --- | --- | --- |
| `honeypot` | Заход на приманочные пути | Блок IP |
| `http-error` | Ответы с указанными кодами (`throw` или `send`) | Блок IP |
| `ip-abuse` | Вызов `abuse.ipAbuse(ip, reason)` из бизнеса | Блок IP |
| `user-abuse` | Вызов `abuse.userAbuse(id, reason)` | Только `onBanUser`, **без** авто-блока IP |

### Honeypot-пути

Строки путей: точное совпадение, простые glob; можно `RegExp`. Regex смотрит `pathname + search`. `methods` опционален.

| Форма | Что матчится |
| --- | --- |
| Точная строка (без `*`) | Полное равенство pathname — `'/.env'` не бьёт `'/.env.local'` |
| `*` | Любые символы **в одном сегменте**, без `/`. `'/wp-*.php'` — да для `/wp-login.php`, нет для `/wp/admin.php` |
| `**` | **Через сегменты**. `'/a/**/c'` — да для `/a/b/d/c`, нет для `/a/c` |
| Хвост `/**` | Сам каталог и любая вложенность. `'/.git/**'` — `/.git`, `/.git/config`, не `/.github` |
| `RegExp` | `pathname + search`, напр. `/^\/admin\?.*dump=/` |

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

Glob только по pathname; для query — regex. `paths` не пустой; проверка при создании.

### Накопление по кодам ошибок

Несколько `statusCodes` в одной стратегии **в одном ведре**. Сузь `paths` / `methods` при необходимости.

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

### Отчёты бизнеса: IP

Когда ответ успешен (logout всегда 204), но нужно считать подозрительные попытки по IP — `ip-abuse` и вызов в маршруте. `reason` — строка, должна совпасть со стратегией; неизвестный `reason` — исключение. Одна стратегия на `reason`.

```typescript
const abuse = createAbuse({
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
    const hit = await services.cache.deleteLoginToken(token);
    if (!hit) {
      await abuse.ipAbuse(ctx.request.ip, 'logout-miss'); // [!code highlight]
    }
    ctx.send(204);
  },
});
```

Для множества reason удобен TypeScript `enum`; второй аргумент `ipAbuse` сужается до членов из стратегий.

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies: reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

### Отчёты бизнеса: пользователь

Злоупотребление на уровне аккаунта — `user-abuse`. Пакет **не пишет в вашу БД** — при лимите только `onBanUser`. При любой `user-abuse` **`onBanUser` обязателен**.

```typescript
const abuse = createAbuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days',
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

`detail`: `count` / `limit`, `banFor` в миллисекундах. `onBanUser` не чаще одного раза на пользователя и reason в окне.

## Ручная блокировка и хуки

| API | Назначение |
| --- | --- |
| `blockIP(ip, duration)` | Ручной блок IP; если уже заблокирован — пропуск |
| `unblockIP(ip)` | Снять блок |
| `isIPBlocked(ip)` | Заблокирован ли |
| `onBlockIP` | Лимит стратегии, `ipAbuse`, ручной `blockIP` |
| `bypass` | Пропустить зондирование и проверку блока |
| `blockedError` | Свой `HttpError` при блоке (по умолчанию 403) |

```typescript
const abuse = createAbuse({
  store,
  strategies: [/* ... */],
  bypass: (ctx) => {
    return ctx.request.pathname === '/health';
  },
  blockedError: new HttpError(429, 'blocked', { code: 'ABUSE_BLOCKED' }),
  onBlockIP: async (ip, reason, detail) => {
    services.logger.warn('abuse.block', { ip, reason, ...detail });
  },
});

await abuse.blockIP('203.0.113.8', '1 day');
await abuse.unblockIP('203.0.113.8');
```

`onBlockIP`: `reason` — `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`; `detail.blockFor` — миллисекунды.

::: tip
Блок abuse — «поймали и закрыли на время»; мягкий глобальный лимит — в [ограничении частоты](/ru/plugins/rate-limit). Можно повесить оба: лимит раньше гасит всплески, abuse банит по стратегиям.
:::

## Связанное

- [Ограничение частоты](/ru/plugins/rate-limit)
- [Кэш](/ru/core/cache) (`store` и `DurationInput`)
- [CSRF](/ru/plugins/csrf)