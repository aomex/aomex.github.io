# 서비스

DB 조회, 외부 호출, 캐시 읽기/쓰기를 라우트 action에서 빼 재사용 **Service**로 모읍니다. **combineServices**로 타입 있는 `services` 봉지를 만들고 Web, Console, Cron에서 같은 이름으로 호출합니다.

비즈니스 클래스는 Service를 상속하고 공개 async 메서드만 노출합니다. 연결·예열은 onInit, 해제는 onDestroy(`protected` 유지, 외부 직접 호출 금지).

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

팩토리 + `combineServices`로 등록합니다. **인프라는 `eager`에** 넣어 부팅 시 연결하고 첫 프로덕션 요청까지 초기화를 미루지 마세요.

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

Web에서 `services` 타입은 `combineServices` 키와 각 Service **공개 메서드**에서 옵니다. `await services.user.findById(1)`에 전체 매개변수·반환 자동 완성이 있고, `onInit`, `onDestroy`, `private`는 **services.user에 없습니다**. 동기 Service 메서드도 밖에서는 **Promise**로 취급하므로 `await`로 통일하세요.

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
비즈니스 코드에서 WebApp / ConsoleApp `services`를 거치지 않고 `new UserService()` 하지 마세요. 종료 시 `onDestroy`가 안 돌고 연결이 새 수 있습니다.
:::

라우트·미들웨어에서:

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

다른 파일에서 `import { services } from './services/index.js'` — 추가 모듈 augment 불필요.

## 지연 로드와 테스트 주입

프로덕션은 `() => import('./xxx.service.js')`로 콜드 스타트를 줄입니다.

```typescript
user: () => import('./user.service.js'),
```

테스트는 비동기 팩토리로 가짜 클래스 반환:

```typescript
user: async () => FakeUserService,
```

::: warning
프로덕션에 `async () => UserService` 쓰지 마세요. 클래스가 이미 메모리에 있어 지연이 무의미하고 RAM만 씁니다. 프로덕션은 항상 `() => import('./user.service.js')`; `async () => 클래스` 패턴은 테스트만.
:::

파일마다 `export default class XxxService`가 loader에 가장 수월합니다.

## eager

서비스는 기본 **지연**: 첫 `await services.xxx`에 인스턴스·`onInit`. `eager` 이름은 `combineServices` 반환 **전**에 생성 — Redis, 로그 등 프로세스 시작 시 준비돼야 하는 인프라에 맞습니다.

```typescript
{ eager: ['cache', 'logger'] },
```

로컬 스모크·최소 CLI는 eager 생략 가능. A의 `onInit`에서 `await services.cache.xxx`인데 cache가 eager가 아니면 첫 비즈니스 호출까지 연결이 밀려 시작 타이밍 버그가 나기 쉽습니다.

## 봉지 병합

대형 저장소는 도메인별 `combineServices` 후 App에 배열로:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

클래스 이름이 Service로 끝나면 [@remember](/ko/core/cache#方法装饰器-remember) 등은 접미사를 뺀 이름으로 캐시 키를 씁니다(`UserService` → `User`).

서비스 간: 클래스 안에서 `import { services } from './index.js'` 후 `await services.other.method()`. 클래스 안은 `this.foo()`; **다른 클래스**만 `await services.other.foo()`.

## 다음 단계

- 세션·Redis: [캐시](/ko/core/cache)
- 사이트 로그: [로거](/ko/core/logger)
- 얇은 라우트: [HTTP 라우팅](/ko/web/router)