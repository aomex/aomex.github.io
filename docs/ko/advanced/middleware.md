---
outline: deep
---

# 사용자 정의 미들웨어

[미들웨어](/ko/core/middleware)의 `middleware.mixin`, `.skip()`(함수·`boolean`), `dependsOn`(업스트림 타입만 빌림)으로 일상 조합이 됩니다. 이 페이지는 보통 **런타임 동작과 OpenAPI / CLI help가 같이 맞아야** 할 때입니다. 미들웨어 하나에서 한 번만 고치면 됩니다.

아래는 **Web 문서 훅 → Console help → 양쪽 재사용** 순서입니다. 따라 하면 Swagger에 trace가 나타나는 미들웨어까지 만듭니다.

## mixin vs web / console

| 필요 | 선택 |
| --- | --- |
| 런타임 `ctx`만, 문서 무관 | `middleware.mixin` — [미들웨어](/ko/core/middleware) |
| Web: 런타임 + OpenAPI operation 패치 | `middleware.web({ fn, openapi })` |
| Console: 런타임 + `--help` 트리 | `middleware.console({ fn, help })` |

`middleware.web` 인스턴스는 Console에 **그대로** 못 걸고 반대도 마찬가지입니다. 양쪽이면 공통 로직을 함수로 빼고 각각 감쌉니다.

## 1단계: 런타임 먼저

목표: 모든 요청에 `traceId`, downstream action에서 읽기.

```typescript
// src/middleware/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```

`middleware.web`에 `{ readonly traceId: string }` 제네릭을 쓰면 **뒤쪽 미들웨어·같은 라우트 action**에 `ctx.traceId` 자동 완성이 생깁니다. 제네릭 없이 값만 넣으면 런타임에는 있어도 TypeScript는 없는 것으로 봅니다.

앱·라우트에 걸고 시험:

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from './middlewares/trace-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
action: async (ctx) => {
  await services.logger.info('ok', { traceId: ctx.traceId });
  ctx.send({ ok: true });
};
```

이때 Swagger에는 trace 설명이 없습니다. 런타임과 문서 주입은 분리됩니다.

## 2단계: OpenAPI 훅

같은 `middleware.web` 옵션에 `openapi`를 추가합니다. 문서 생성이 라우트를 스캔할 때 훅이 호출되어 operation(또는 전체 document)을 고칩니다.

흔한 진입점(타입 힌트에서 고르기, 전부 쓸 필요 없음):

| 훅 | 용도 |
| --- | --- |
| `onMethod` | **이 operation**에 파라미터·응답·security |
| `postMethod` | 다른 훅 후 마무리(예: envelope 통일) |
| `onDocument` | `components.securitySchemes` 등 전역 블록 |

`traceId`를 단 라우트마다 응답 헤더 설명:

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```

[OpenAPI 생성](/ko/plugins/openapi)을 다시 돌리거나 Swagger를 열면 해당 미들웨어가 걸린 operation에 `X-Trace-Id`가 보여야 합니다. 훅 구조 오류는 `pnpm start`에서 안 터지므로 생성 결과를 확인하세요.

::: tip
런타임에서 **아무 것도 안 하고** 문서만 바꾸는 미들웨어라면 라우트 `docs`나 생성기 설정으로 충분한지 먼저 보세요. 빈 레이어는 `mount` 읽기를 어렵게 합니다.
:::

## 3단계: Console도 같은 패턴

명령에 `--help` 문구가 필요하면 `middleware.console` + `help`:

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 按类型提示往帮助树贡献说明；具体字段以编辑器补全为准
    },
  },
});
```

`commander.create`의 `mount`에 걸면 Web `openapi`와 대칭입니다. HTTP 계약 한쪽, CLI help 한쪽.

## 4단계: 양쪽에서 로직 공유

UUID 로직을 두 벌 복사하지 마세요. 함수 추출 후 감싸기:

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* 同上 */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```

## 잘못 붙였을 때 흔한 현상

| 현상 | 원인 추정 |
| --- | --- |
| action에 `ctx.traceId` 자동 완성 없음 | `middleware.web` / `mixin`에 Props 제네릭 누락 |
| 런타임 헤더는 있는데 Swagger 없음 | `fn`만 있고 `openapi` 없음, 또는 생성 시 해당 라우트 미스캔 |
| Console에 `middleware.web` 타입 오류 | 단계 불일치, `middleware.console` 사용 |
| 헬스 체크가 인증에 막힘 | `.skip()` — [미들웨어 · skip](/ko/core/middleware#用-skip-绕过某类请求) |

## 관련

- 순서, `.skip()`, `dependsOn`, ctx 병합: [미들웨어](/ko/core/middleware)
- 플러그인: [HTTP 액세스 로그](/ko/plugins/http-access-log), [Auth](/ko/plugins/auth)
- 문서 생성: [OpenAPI 생성](/ko/plugins/openapi)
