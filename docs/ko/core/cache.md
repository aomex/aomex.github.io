# 캐시

**CacheService**를 만듭니다. memory / file / Redis 어댑터를 고르고 `this.cache`로 읽고 씁니다. 로그인 **session**(token → 사용자)으로 발급·인증 읽기·로그아웃 삭제까지 연결합니다.

하위 클래스는 `createAdapter()` 구현; 비즈니스 키는 `protected readonly` + `this.concat`으로 모아 문자열을 흩뿌리지 않습니다.

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

`get<T>(key)`는 제네릭으로 `T | null`; `set` 세 번째 인자는 만료 **밀리초**, `this.ttl.DAY`·`this.ttl.MINUTE`로 매직 넘버를 줄입니다. `services.cache.xxx`는 CacheService 선언과 같아 서명 변경 시 라우트·인증 콜백까지 컴파일러가 따라갑니다.

등록·예열(프로덕션 Redis는 especially eager):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
프로덕션·다중 인스턴스에서 cache에 eager 없으면 첫 캐시 읽기에 연결 비용이 붙어 tail latency가 흔들립니다.
:::

## session 읽기/쓰기

로그인 후 token → 사용자를 캐시에 씁니다. 인증 `onLoaded`에서 읽고 로그아웃 시 delete. 키는 `this.concat` + 버전 prefix, 페이로드 변경 시 한 곳에서 무효화.

비즈니스(로그인/인증/로그아웃):

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

token 발급·DB는 User / Auth Service; CacheService는 저장만.

## memory와 Redis

어댑터가 저장 위치를 정합니다. **memory**: 의존성 없음, 프로세스 내, 재시작 시 비움 — 로컬·단위 테스트. **Redis**: 다중 인스턴스 session·속도 제한. **file**: 가벼운 디스크. 비즈니스는 보통 `createAdapter()`만 바꿉니다.

로컬·단위 테스트는 `@aomex/cache/memory`:

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

프로덕션·공유 session/속도 제한은 `@aomex/cache-redis-adapter`, 보통 `createAdapter`만 변경:

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

단일 머신 약간의 영속은 `@aomex/cache/file`.

## 키 이름과 버전

`protected readonly`로 접두사(예: `login-token`), `this.concat`으로 token/id 결합. 접두사에 버전(`v1` → `v2`)을 넣으면 **이름 충돌 없이** 구 session 폐기.

v1 → v2는 키 일괄 무효, 페이로드 변경에 흔함:

```typescript
protected readonly loginTokenKey = this.concat('login-token', 'v2');
```

메서드마다 버전 문자열을 흩뿌리지 말고 클래스 `readonly` 접두사 + `this.concat`.

## setNX와 카운터

`setNX`는 key 없을 때만 씁니다 — 분산 락, 멱등 「한 번만」. TTL은 최악 작업 시간보다 길게. `increment` / `expire`는 OTP 실패 횟수·슬라이딩 윈도.

락·멱등(TTL > 최악 작업 시간):

```typescript
const ok = await this.cache.setNX(lockKey, '1', 30_000);
if (ok) {
  await this.cache.expire(lockKey, 30_000);
}
```

OTP 실패 횟수 등은 increment / expire.

## `@remember` 메서드 데코레이터

읽기 많고 잠깐 캐시 가능한 조회는 **비즈니스 Service**에 `@remember`. CacheService.onInit에서 `remember.setInstance(this)` + `eager: ['cache']`, 종료 시 `deleteInstance`.

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
      return `report:${id}`;
    },
    defaultValue: null,
  })
  async find(id: number) {
    return db.report.find(id);
  }
}
```

::: warning
부작용 있는 쓰기에는 달지 마세요. 무효화는 delete나 키 버전. 쓰기에 `@remember` 쓰면 오래된 값이 남습니다.
:::

## 다음 단계

- 등록·eager: [서비스](/ko/core/service)
- 인증 session: [Auth](/ko/plugins/auth)
- Bearer: [Bearer 전략](/ko/plugins/auth-bearer-strategy)