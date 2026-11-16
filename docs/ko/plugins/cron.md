---
outline: deep
---

# Cron 예약 작업

Console 프로세스에서 기존 Console 명령을 스케줄로 실행—수동 CLI 대신 resident 프로세스가 깨웁니다. HTTP가 아니라 **Console mount**에 `crons()`를 둡니다.

```bash
pnpm add @aomex/cron
```

## ConsoleApp에 crons() 마운트

`crons()`는 Console 프로세스에서 스케줄러 시작: `commanders` 아래 command를 스캔해 cron 표현식이 있으면 등록합니다.

```typescript
import { commanders, ConsoleApp } from '@aomex/console';
import { crons } from '@aomex/cron';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [ // [!code focus:7]
    crons({
      commanders: './src/commanders', // [!code highlight]
      port: 9786,
    }),
    commanders('./src/commanders'),
  ],
});
```

command 파일에 스케줄 선언([Command 라우팅](/ko/console/commander)과 같은 파일):

```typescript
import { Commander } from '@aomex/console';
import { cron } from '@aomex/cron';

export const commander = new Commander();

commander.create('report:daily', { // [!code focus:6]
  mount: [cron('0 9 * * *')], // [!code highlight]
  action: async (ctx) => {
    await sendReport();
  },
});
```

실행: 프로세스가 often 상주; 디버그는 같은 command를 `aomex` CLI로도 가능.

## 로직 안 ctx.cron

```typescript
action: async (ctx) => {
  while (ctx.cron.isAlive()) { // [!code highlight]
    await drainQueue();
  }
};
```

### isCurrentEpoch(): 이 창 안에 끝내기

다음 트리거 전에 끝내야 하는 배치—`isCurrentEpoch()`로 창 안인지 확인.

```typescript
action: async (ctx) => {
  for (const chunk of chunks) {
    if (!ctx.cron.isCurrentEpoch()) { // [!code highlight]
      break;
    }
    await processChunk(chunk);
  }
};
```

## crons() 앱 수준 필드

| 필드 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `commanders` | CLI와 같은 디렉터리 | — |
| `store` | 분산 잠금/중복 방지 | 메모리 |
| `timezone` | 크론 TZ | 시스템 |

```typescript
cron({
  time: '0 9 * * *', // [!code highlight]
  concurrent: 1,
  args: ['--verbose'],
});
```

### 분산 작업

기본 `store`는 **프로세스 메모리**—단일 Console OK. 여러 Pod가 각각 스케줄을 쏘면 중복 실행.

```typescript
import { CacheRedisAdapter } from '@aomex/cache-redis-adapter';

crons({
  commanders: './src/commanders',
  port: 9786,
  store: new CacheRedisAdapter({ host: '127.0.0.1', port: 6379 }), // [!code highlight]
});
```

::: warning
메모리 `store`로 여러 복제본이면 **같은** cron이 **각** 복제본에서 돕니다. 단일 프로세스 로컬·개발에 맞추거나 Redis 등 공유 store로 바꾸세요.
:::

## 관련

- 명령 정의: [Commander](/ko/console/commander)
- Console 옵션: [Console 옵션](/ko/console/options)