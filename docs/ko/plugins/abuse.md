---
outline: deep
---

# 남용 방어

디렉터리 스캔, 허니팟 적중, 짧은 시간에 쏟아지는 404, 로그아웃에 가짜 token 시도——이런 것은 종종 「정상적인 과다」가 아니라 경계를 탐색하는 동작이다. `@aomex/abuse`는 전략별로 **카운트**하고 한도에 도달하면 **IP를 차단**한다(또는 계정 정지는 콜백에 맡긴다). [요청 제한](/ko/plugins/rate-limit)과 보완 관계다: 제한은 순간 QPS, 남용 방어는 프로빙과 비즈니스가 보고하는 악의 행위에 맞는다.

카운트와 차단 상태는 `@aomex/cache` 어댑터(memory / Redis 등)에 둔다. 여러 인스턴스면 Redis를 공유한다. `ctx.request.ip`에 의존한다. 프로덕션에서는 `proxyIP: { mode: 'detect' }`(또는 고정 신뢰 체인)를 설정하지 않으면 요청이 전부 리버스 프록시 IP로 보일 수 있다.

```bash
pnpm add @aomex/abuse
# 기존 @aomex/cache(프로덕션 Redis 어댑터)도 필요
```

## 미들웨어 장착

`createAbuse` 반환값은 **미들웨어이자 API**(`userAbuse` / `ipAbuse` / `blockIP` 등)이며 **ctx에 붙지 않는다**. 인스턴스를 만들고 `mount`한 뒤 라우트나 Service에서 같은 객체를 호출한다.

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

로컬/단위 테스트는 memory. 프로덕션 다중 복제본은 `store`를 Redis 어댑터로 바꾸지 않으면 차단은 해당 호스트에만 남는다. `window` / `blockFor` 등 기간은 밀리초 또는 `'1 hour'`, `'30m'` 같은 문자열——[캐시](/ko/core/cache#기간-durationinput)와 같은 `DurationInput`이다.

요청마다: IP가 이미 차단됨 → 기본 **403**. 허니팟 한도 도달 → 즉시 차단하고 403. `http-error`는 응답 후 카운트.**한도를 넘긴 그 요청은 원래 상태 코드 유지**, 다음 요청부터 403.

## 네 가지 전략

| 전략 | 무엇이 카운트 | 한도 도달 시 |
| --- | --- | --- |
| `honeypot` | 의도적으로 둔 미끼 경로 접근 | IP 차단 |
| `http-error` | 지정 상태 코드 응답(`throw` 또는 `send`) | IP 차단 |
| `ip-abuse` | 비즈니스가 `abuse.ipAbuse(ip, reason)` 호출 | IP 차단 |
| `user-abuse` | 비즈니스가 `abuse.userAbuse(id, reason)` 호출 | `onBanUser`만. **IP 자동 차단 없음** |

### 허니팟 경로

경로 문자열은 정확 일치·단순 glob. 정규식도 가능. 정규식은 `pathname + search`를 검사한다. `methods`는 선택. 생략하면 메서드 무관.

| 문법 | 매칭 범위 |
| --- | --- |
| 정확 문자열(`*` 없음) | pathname 전체 일치. `'/.env'`는 `'/.env.local'`에 안 맞음 |
| `*` | **한 세그먼트 안** 임의 문자, **`/`는 넘지 않음**. `'/wp-*.php'`는 `/wp-login.php`에 맞고 `/wp/admin.php`는 아님 |
| `**` | **여러 세그먼트 가능**. `'/a/**/c'`는 `/a/b/d/c`에 맞고 `/a/c`는 아님(가운데 최소 한 세그먼트) |
| 끝 `/**` | 디렉터리 자신과 깊은 하위 경로. `'/.git/**'`는 `/.git`, `/.git/config`에 맞고 `/.github`는 아님 |
| `RegExp` | `pathname + search`, 예 `/^\/admin\?.*dump=/` |

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

glob은 pathname만. query는 무시. query 포함은 정규식. `paths`는 비울 수 없고 생성 시 검증. 중괄호 등은 확장 문법이 아니라 리터럴.

### 오류 상태 코드 누적

한 전략 안 여러 `statusCodes`는 **한 버킷에 합산**. `paths` / `methods`로 좁힐 수 있음.

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

API 스캔 방어에 적합. 로그인 401도 엄격히 하려면 `paths` 있는 별도 전략을 추가하고 전역 404와 같은 버킷에 섞지 말 것.

### 비즈니스 보고: IP

응답은 성공 그대로(예: logout 항상 204)인데 IP 단위로 「의심 시도」를 기록하려면 `ip-abuse`와 라우트에서 호출. `reason`은 문자열 가능. 전략 선언과 일치해야 하고 알 수 없는 reason은 런타임 예외. reason당 전략 하나.

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

reason이 늘면 TypeScript `enum`(문자열·숫자 멤버 모두)으로 모을 수 있다. 전략과 `ipAbuse`에 같은 멤버를 쓰면 두 번째 인자는 전략에 있는 멤버로 좁혀진다.

```typescript
enum IpAbuseReason {
  LogoutMiss = 'logout-miss',
  TokenProbe = 'token-probe',
}

// strategies: reason: IpAbuseReason.LogoutMiss
await abuse.ipAbuse(ctx.request.ip, IpAbuseReason.LogoutMiss);
```

### 비즈니스 보고: 사용자

계정 단위 남용(프로모션 남용, 크리덴셜 스터핑 이후 사용자 축 등)은 `user-abuse`. 패키지는 **사용자 DB를 쓰지 않음**——한도에 도달하면 `onBanUser`만 호출. `user-abuse`가 하나라도 있으면 **`onBanUser` 필수**(생성 시 검사).

```typescript
const abuse = createAbuse({
  store,
  strategies: [
    {
      strategy: 'user-abuse',
      reason: 'order-probe',
      limit: 10,
      window: '1 day',
      banFor: '7 days', // 권장 정지 기간, 콜백으로 전달
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

`detail`에 `count` / `limit`, 밀리초로 해석된 `banFor`(`undefined` 가능). 같은 사용자·같은 reason에서 창 안 `onBanUser`는 최대 한 번.

## 수동 차단과 훅

| API | 역할 |
| --- | --- |
| `blockIP(ip, duration)` | 수동 IP 차단. 이미 차단이면 건너뜀 |
| `unblockIP(ip)` | 차단 해제 |
| `isIPBlocked(ip)` | 차단 여부 |
| `onBlockIP` | 전략 한도, `ipAbuse` 한도, 수동 `blockIP` |
| `bypass` | 프로빙·차단 검사 생략 |
| `blockedError` | 차단 시 `HttpError`(기본 403) |

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

`onBlockIP`의 `reason`은 `'honeypot' | 'http-error' | 'ip-abuse' | 'manual'`. `detail.blockFor`는 밀리초.

::: tip
남용 차단은 「잡혔으면 잠깐 잠그기」에 가깝다. 전역 소프트 한도는 [요청 제한](/ko/plugins/rate-limit). 둘 다 mount 가능: 제한을 앞에 두고 스파이크를 줄이고, 남용 방어로 전략 누적 후 차단.
:::

## 관련

- [요청 제한](/ko/plugins/rate-limit)
- [캐시](/ko/core/cache)(`store` 어댑터와 `DurationInput`)
- [CSRF](/ko/plugins/csrf)