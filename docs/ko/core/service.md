# 서비스

「DB 조회, 외부 호출, 캐시 읽기·쓰기」를 라우트 action 밖으로 빼 **Service**로 모으고, **combineServices**로 타입이 있는 `services` 객체를 만듭니다. Web, Console, Cron에서 같은 이름으로 호출합니다.

비즈니스 클래스는 Service를 상속하고 바깥에는 일반 async 메서드만 노출합니다. DB 연결·예열은 `onInit`, 해제는 `onDestroy`에 두되 protected로 유지해 외부에서 직접 호출하지 않게 합니다.

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

팩토리와 `combineServices`로 등록합니다. **인프라는 eager에 넣는 것을 권장**해 앱 기동 직후 연결하고, 첫 라이브 요청까지 초기화를 미루지 않게 합니다:

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

Web에 연결하면 `services` 타입은 `combineServices`의 키 이름과 각 Service의 **공개 메서드**에서 옵니다. `await services.user.findById(1)`은 인자·반환 타입 추론이 되고, `onInit`, `onDestroy`, private 필드는 `services.user`에 **나타나지 않습니다**. 동기로 작성한 Service 메서드도 바깥에서 호출할 때 타입상 **Promise**로 다루며 `await`만 통일하면 됩니다.

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
비즈니스 코드에서 `new UserService()`만 만들고 WebApp / ConsoleApp의 `services`에 넣지 않으면 종료 시 프레임워크가 관리하지 못해 연결이 누설될 수 있습니다.
:::

라우트나 미들웨어에서:

```typescript
const user = await services.user.findById(1);
await services.logger.info('用户已查询', { userId: user?.name });
```

다른 파일에서 `import { services } from './services/index.js'` 하면 되고, 모듈마다 추가 래핑은 필요 없습니다.

## 지연 로딩과 테스트 주입

운영 코드에서는 `() => import('./xxx.service.js')`로 로딩을 늦춰 콜드 스타트를 줄입니다:

```typescript
user: () => import('./user.service.js'),
```

테스트에서 가짜 구현을 넣을 때는 비동기 팩토리가 클래스를 바로 반환하게 쓸 수 있습니다:

```typescript
user: async () => FakeUserService,
```

::: warning
비즈니스 코드를 `async () => UserService`처럼 쓰지 마세요. 클래스가 이미 현재 모듈에 올라와 지연 로딩이 무의미하고 런타임 메모리만 늘어납니다. 운영은 항상 `() => import('./user.service.js')`이고, 위 패턴은 테스트 주입용만 쓰세요.
:::

파일마다 `export default class XxxService`가 가장 단순하고, loader가 여러 export를 추측할 필요가 없습니다.

## eager

기본적으로 서비스는 **지연 로딩**입니다. 첫 `await services.xxx`에 인스턴스화·`onInit`이 실행됩니다. `eager`에 적힌 이름은 `combineServices`가 반환되기 **전에** 만들어집니다 — Redis, 로그처럼 프로세스가 뜨자마자 준비돼야 하는 인프라에 맞습니다.

```typescript
{ eager: ['cache', 'logger'] },
```

로컬 스모크·최소 CLI는 eager 생략 가능합니다. A의 `onInit`에서 `await services.cache.xxx`를 쓰는데 cache가 eager가 아니면 첫 비즈니스 호출까지 연결이 밀려 시작 단계 타이밍 문제가 나기 쉽습니다.

## 라이프사이클 훅

어떤 리소스는 Service로 만들 필요도 없고 `services` 백에도 안 들어가지만(모듈 수준 PrismaClient, 플러그인 내부 Redis store 등), 프로세스 기동 시 연결·종료 시 끊기는 여전히 필요합니다. 이때 `registerLifecycle`을 씁니다. 등록 시 곧바로 `onInit`이 돌고, `WebApp` / `ConsoleApp` 종료 시 `onDestroy`가 돌습니다.

```typescript
import { registerLifecycle } from '@aomex/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

await registerLifecycle({ // [!code focus:4]
  onInit: () => prisma.$connect(),
  onDestroy: () => prisma.$disconnect(),
});
```

반환 함수는 **등록 해제**용입니다(이미 종료했거나 해제한 뒤 호출해도 효과 없음). `onInit`이 실패하면 destroy 대기열에 들어가지 않습니다. 요청 제한 등 플러그인 내부도 같은 훅으로 store를 관리하므로, 비즈니스 쪽에서 다시 등록할 필요는 보통 없습니다.

이미 `combineServices`에 넣은 클래스는 `onInit` / `onDestroy`만 쓰면 되고 `registerLifecycle`으로 한 겹 더 쌀 필요는 없습니다.

## 여러 서비스 백 병합

큰 저장소는 도메인별로 `combineServices`를 여러 번 만든 뒤 App에 합칩니다:

```typescript
const app = new WebApp({
  services: [domainA, domainB], // [!code highlight]
  logger: domainA.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

클래스 이름이 Service로 끝나면 [`createRemember`](/ko/core/cache#캐시-데코레이터) 등은 접미사를 뺀 이름으로 캐시 key를 구분합니다(UserService → User).

서비스끼리 호출할 때는 클래스 안에서 `import { services } from './index.js'` 후 `await services.other.method()` 하면 됩니다. 클래스 안에서는 `this.foo()` 그대로이고, **다른 클래스**만 `await services.other.foo()`를 씁니다.

## 다음 단계

- session, `createRemember`: [캐시](/ko/core/cache)
- 사이트 로그: [로거](/ko/core/logger)
- 얇은 라우트: [HTTP 라우팅](/ko/web/router)