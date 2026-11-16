---
outline: deep
---

# HTTP 액세스 로그

끝난 요청마다 한 줄: method, URL, status, duration—트래픽·느린 엔드포인트 파악용.

**프로덕션에서는 Nginx `access_log`(또는 게이트웨이/LB 내장) 우선**: 형식 일관, Node 이벤트 루프 부담 감소, 수집 쉬움. `@aomex/http-access-log`는 로컬 개발, 프록시 없음, **userId / tenant / traceId**처럼 앱 안에서만 있는 필드가 필요할 때 맞습니다.

```bash
pnpm add @aomex/http-access-log
```

## 앞쪽 전역 마운트

앱 안 액세스 로그를 원하면 `routers` **앞**에 `httpAccessLog()`—요청 후 combined 스타일 한 줄. 404·검증 400도 집계됩니다. 뒤에 두면 전체 체인 duration이 어긋납니다.

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

기본은 logger 경유 combined 비슷 한 줄(often 콘솔). 필드 대략: ip, method, url, statusCode, duration, contentLength.

::: warning
`routers` 뒤에 두면 체인 duration·초기 404가 「전체 사이트 감사」 의도와 안 맞을 수 있습니다.
:::

`customTokens`는 `WebContext`를 받습니다. `ctx.auth` 등은 **내부 auth** 완료 후—액세스 로그는 `await next()` 이후 써서 보통 양파 안쪽 props를 봅니다. `ctx.auth`가 항상 `-`면 순서 확인: 라우트 auth와 바깥 로그면 auth를 `Router.mount`로 올려야 할 수 있습니다.

## 형식과 싱크

| 기능 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `format` | 프로덕 ELK/Loki 필드 순서 맞춤 | 내장 combined 스타일 |
| `transports` | 파일, 원격 수집 | console(`logger` 경유) |
| `customTokens` | userId, tenant, traceId | — |
| `HttpAccessLogToken.*` | `ip` / `method` / `duration` 등 조합 | 패키지 export |

### 프로덕션: 파일

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

### userId after auth

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

[Response time](/ko/plugins/response-time)와 자주 짝: 헤더는 클라이언트/게이트웨이, 로그 `duration`은 플랫폼 집계. 프로덕션 액세스 로그는 여전히 엣지 선호, 이 플러그인은 앱 안에서만 포맷을 맞출 때.

## 다음 단계

- 시간 헤더: [응답 시간](/ko/plugins/response-time)
- 추적: [비동기 추적](/ko/plugins/async-trace)
- [미들웨어](/ko/core/middleware)