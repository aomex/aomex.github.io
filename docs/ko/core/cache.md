# 캐시

**CacheService**를 만든다. memory / file / Redis 어댑터를 고르고 `this.cache`로 읽고 쓴다. 로그인 **session**(token → 사용자 정보)으로 「발행 · 인증 읽기 · 로그아웃 삭제」흐름을 통과한다.

하위 클래스에서 `createAdapter()`를 구현한다. 업무 접두사는 `protected readonly`와 `this.key(...)`로 `CacheKey`로 모으고, 메서드 안에서는 `.key(token)`을 이어 붙여 문자열이 흩어지지 않게 한다.

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

`get` / `set` / `delete` 등은 **문자열 또는 `CacheKey`**를 받는다. `get<T>(key)`에 제네릭을 붙이면 반환 타입은 `T | null`. `set` / `setNX` / `expire` 만료와 `@remember`의 `duration`은 **`DurationInput`**: 밀리초 또는 `'7 days'`, `'30m'`, `'1.5 hours'` 같은 문자열(아래 참고). `services.cache.xxx`의 메서드 이름·인자는 CacheService에 선언한 것과 같다. 시그니처를 바꾸면 컴파일러가 라우트와 인증 콜백까지 따라 간다.

등록과 워밍업(프로덕션에서 Redis로 바꿀 때는 특히 `eager` 권장):

```typescript
await combineServices(
  {
    cache: () => import('./cache.service.js'),
  },
  { eager: ['cache'] }, // [!code highlight]
);
```

::: warning
프로덕션이나 다중 인스턴스에서 cache에 eager를 쓰지 않으면 첫 캐시 읽기에 Redis 연결 비용이 붙고 tail latency가 튈 수 있다.
:::

## session 읽기·쓰기

로그인 후 token을 발급하면 「token → 사용자 정보」를 캐시에 쓴다. 인증 onLoaded에서 읽고, 로그아웃 시 delete한다. 키 이름은 버전이 있는 `CacheKey` 접두사를 쓴다. 릴리스 때 세션 구조를 바꾸면 한곳만 고쳐 일괄 무효화할 수 있다.

업무 측(로그인 / 인증 / 로그아웃):

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

token 발급·DB 조회는 User / Auth 등 Service에 둔다. CacheService는 저장·조회만 담당한다.

## 어댑터 선택

어댑터가 데이터 위치를 정한다. **memory**는 의존성 없음·프로세스 내부·재시작 시 비움. 로컬·단위 테스트용. **Redis**는 다중 인스턴스에서 session·rate limit 카운트를 공유. 디스크에 조금 남기려면 **file**. 업무 코드는 보통 `createAdapter()`만 바꾸고 읽기·쓰기 API는 동일.

로컬 개발·단위 테스트는 `@aomex/cache/memory`. 의존성 없음, 재시작 시 데이터 소실:

```typescript
import { CacheMemoryAdapter } from '@aomex/cache/memory';

protected createAdapter() {
  return new CacheMemoryAdapter();
}
```

프로덕션·다중 인스턴스 session / rate limit 공유는 `@aomex/cache-redis-adapter`(`ioredis` 패키지 포함. 대개 `createAdapter`만 변경):

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

protected createAdapter() {
  return new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 });
}
```

단일 머신에서 가벼운 디스크 영속은 `@aomex/cache/file`.

## 키 조합: CacheKey

`this.key(...)`의 반환은 **`CacheKey`**이며 일반 문자열이 아니다. 조각은 `:`로 이어지고 `.key` / `.keyHash` / `.toHash()`를 계속 붙일 수 있다. `this.cache.get` / `set` 등이 그대로 받는다. `String(...)`은 필요 없다.

```typescript
this.key('user', 1); // user:1
this.key('user').key(1); // 同上
this.key('user').keyHash(1); // user:<md5('1')>，前缀可读
this.key('user', 1).toHash(); // <md5('user:1')>
this.keyHash('user', 1); // 同上，整键哈希
```

| 쓰는 법 | 얻는 것 |
| --- | --- |
| `this.key('a', 1)` | 읽기 쉬운 키 `a:1` |
| `prefix.key(id)` | 기존 `CacheKey` 접두사 뒤에 한 단 더 |
| `this.key('a').keyHash(id)` | 접두사 유지, **이번 인자만 해시** |
| `this.key(...).toHash()` / `this.keyHash(...)` | **전체** MD5, 읽기 쉬운 접두사 없음 |

조각이 길거나 이상한 문자가 있거나 Redis에 평문을 노출하고 싶지 않을 때 해시를 쓴다. 일상 업무 키는 읽기 쉬운 접두사가 디버깅에 유리하다. 예전 단독 `hash()`는 제거되었고 위 패턴으로 통일한다.

### 접두사와 버전

`protected readonly` 필드로 업무 접두사(예: `login-token`)를 모으고, 메서드에서는 `.key(token)` / `.key(id)`를 이어 붙인다. 곳곳에 매직 문자열을 쓰지 않는다. 접두사에 버전(`v1` → `v2`)을 넣으면 **이름 충돌 없이** 이전 session을 폐기한다:

```typescript
protected readonly loginTokenKey = this.key('login-token', 'v2');
```

## 기간 DurationInput

만료 시간에 `60_000`을 직접 쓰지 않아도 된다. `set` / `setNX` / `expire`, `@remember`의 `duration`은 다음을 받는다:

- **number**: 밀리초(이전과 동일)
- **문자열**: 숫자 + 단위, 공백 선택——`'30m'`, `'1 hour'`, `'7 days'`

자주 쓰는 단위: `ms` / `s`(`sec` / `second`) / `m`(`min` / `minute`) / `h`(`hr` / `hour`) / `d`(`day`) / `w`(`week`) / `month` / `y`(`year`). `month`는 30일, `year`는 365일. 다른 곳에서 읽을 수 있는 기간을 밀리초로 바꿀 때 `import { parseDuration } from '@aomex/common'`도 쓸 수 있다.

```typescript
await this.cache.set(key, session, '7 days');
await this.cache.setNX(lockKey, '1', '30 seconds');
await this.cache.expire(key, '1 hour');
```

## exists: 있는지 여부만

키가 **있는지**만 알면 되고 값을 읽어 디코딩할 필요가 없을 때는 `exists`를 쓴다. `boolean`을 반환하며 문자열 또는 `CacheKey`를 받는다.

```typescript
const key = this.loginTokenKey.key(token);
if (await this.cache.exists(key)) {
  // 세션이 아직 있음 — get 할지 결정
}
```

`get`과의 차이: `get`은 미스일 때 `null`(직접 판단해야 함)이고 값을 역직렬화한다. `exists`는 어댑터에 「이 키가 아직 있는지」만 묻는다. 자리 표시 마커, 락을 아직 잡고 있는지, 큰 객체를 꺼내기 전 탐색에 맞다.

::: tip
「먼저 exists 후 get」사이에 다른 쪽이 키를 지우거나 바꿀 수 있다. 엄격한 트랜잭션 조건으로 쓰지 마라. 락 획득·멱등은 아래 `setNX`를 쓴다.
:::

## setNX와 카운터

`setNX`는 키가 없을 때만 쓴다. 분산 락·멱등 「한 번만 처리」에 쓴다. TTL은 작업 최악 시간을 덮어야 한다. 그렇지 않으면 락 만료 후 다른 worker가 가져갈 수 있다. `increment` / `expire`는 인증 코드 실패 횟수·슬라이딩 윈도우에 맞다.

락 획득·멱등(TTL은 작업 최악 시간보다 커야 함):

```typescript
const ok = await this.cache.setNX(lockKey, '1', '30 seconds');
if (!ok) {
  return;
}
```

인증 코드 실패 횟수: 먼저 `increment`, 첫 호출(또는 TTL이 아직 없을 때)에 `expire`로 창을 연다——Redis `INCR`과 같은 습관. memory 어댑터의 증감은 **기존 TTL을 유지**하고 숫자를 바꿔도 만료를 지우지 않는다.

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

## 캐시 데코레이터

업무 메서드마다 「get → 없으면 계산 → set」을 반복하면 번거롭고, 같은 key 동시 요청이 여러 번 계산된다. `createRemember`는 메서드 데코레이터 `@remember`를 만든다. 히트면 바로 반환. 미스면 원 메서드만 실행해 기록. **같은 key 동시 요청은 하나만 실행**, 나머지는 결과를 기다린다.

데코레이터는 자신의 캐시 서비스 클래스에 묶는다. `BaseCacheService` **하위 클래스 생성자**를 넘긴다(기반 클래스·인스턴스 불가). `cache.service.ts`에 두는 것이 편하고, 업무 쪽은 `remember`를 import한다:

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

`BaseCacheService`는 `onInit`에서 어댑터 연결 후 remember를 자동으로 걸고 종료 시 해제한다. **수동 등록은 불필요**. `combineServices`에서는 여전히 `eager: ['cache']` 권장. 캐시 준비 전이면 데코레이트된 메서드는 **대기**. 종료 후 호출은 **예외**.

### 업무 메서드에 적용

메서드는 **async**(Promise 반환)여야 한다. 기간만 넘기면 「캐시 유지 시간」(`DurationInput`):

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

key나 기본값을 쓰려면 객체를 넘긴다. 이때 `await services.report.find(1)` 첫 호출은 DB로 가고, 창 안에서 같은 인자로 다시 호출하면 캐시를 읽는다. `duration`은 기록 후 만료 시간:

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

| 쓰는 법 | 역할 |
| --- | --- |
| `@remember('1 minute')` / `@remember(60_000)` | 만료만 지정. key는 기본 규칙 |
| `duration` | 필수(객체 형태). 캐시 기간 |
| `key: '고정 문자열'` | 메서드 전체 하나의 키(무인자·전역 단일 결과) |
| `key: (...args) => string` | 인자로 키 조합. `this`는 업무 인스턴스 |
| `defaultValue` | 원 메서드가 `null`일 때 호출자에게 보이는 값(기본 `null`) |

### 기본 key 조합

`key`를 쓰지 않으면 프레임워크는 다음을 쓴다:

`클래스 이름 또는 displayName` + `-` + `메서드 이름` + `-` + `JSON.stringify(인자)`

`Service`를 상속하고 클래스 이름이 `Service`로 끝나면 접미사를 뺀 `displayName`(`ReportService` → `Report`)으로 키에 긴 접미사를 넣지 않는다. 인자는 JSON에 들어간다. **직렬화 불가·불안정한 값**(`Date`, 순환 참조, 매번 다른 객체 리터럴)을 넣으면 key가 맞지 않아 캐시가 사실상 꺼진다. 인자가 많거나 구조가 어지러우면 `key`를 직접 쓰는 편이 낫다.

### 동시성과 빈 결과

같은 key가 동시에 오면 첫 호출이 `setNX`로 자리를 잡고 원 메서드를 실행한다. 자리 표시 키는 약 20초, 실행 중 갱신된다. 나머지는 자리가 사라질 때까지 폴링 후 캐시를 읽거나 `defaultValue`를 받는다. 캐시 스탬피드 방지용이지 범용 분산 락이 아니다——범용 락으로 쓰지 않는다.

원 메서드가 `null`을 반환하면 **`null`은 쓰지 않는다**(「없음」을 오래 고정하지 않음). 호출자는 `defaultValue`를 본다. 「명시적으로 없음」을 캐시하려면 키를 설계하거나 수동 `this.cache.set`을 쓴다.

### 여러 캐시

로컬 memory와 공유 Redis를 쓸 때 각각 `BaseCacheService` 하위 클래스를 만들고 각각 `createRemember`를 호출한다. 범위는 **서비스 클래스** 단위. `fork()`는 없다. 어떤 `remember`를 붙이느냐에 따라 저장소가 정해진다.

::: warning
**읽기 많고 쓰기 적으며 잠깐 stale해도 되는** 조회에만 붙인다. DB 쓰기·SMS·재고 차감 같은 부작용 메서드에는 붙이지 않는다——캐시는 낡은 값이다. 데이터가 바뀌면 해당 키를 `cache.delete`하거나 key 버전을 올린다(위 key 조합 참고).
:::

## 다음 단계

- 서비스 등록과 eager: [서비스 계층](/ko/core/service)
- 남용 카운트 `store`: [남용 방어](/ko/plugins/abuse)
- 인증에서 session 사용: [Auth 통합 진입점](/ko/plugins/auth)
- Bearer와 token 전략: [Bearer 전략](/ko/plugins/auth-bearer-strategy)