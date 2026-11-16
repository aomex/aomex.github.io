---
outline: deep
---

# 응답 시간

서버 처리 시간을 각 응답 헤더(예: `X-Response-Time`)에 기록합니다. 브라우저, 게이트웨이, 느린 엔드포인트를 보는 통합 테스트에 유용합니다. 옵션 없이 마운트하면 됩니다.

```bash
pnpm add @aomex/response-time
```

## 액세스 로그 옆에

`responseTime()`에는 설정이 없습니다. 액세스 로그와 함께 두세요. 요청이 끝나면 헤더에 duration이 실립니다. Nginx `access_log` / [httpAccessLog](/ko/plugins/http-access-log)의 `duration`을 보완합니다(헤더는 클라이언트·게이트웨이, 로그는 플랫폼 집계). 프로덕션 액세스 로그는 보통 엣지에 둡니다. 이 플러그인은 「응답 헤더에 시간이 필요한가」만 답합니다.

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

`process.hrtime`을 쓰며 헤더는 often `12.345ms` 형태입니다. 실패 응답에도 값이 붙고, 오류 경로는 `HttpError.headers`에 합쳐질 수 있습니다.

일반 `WebMiddleware`이며 비즈니스 `ctx` 타입은 바뀌지 않습니다. Network 패널에서 보면 되고 action에서 헤더를 수동으로 쓸 필요는 없습니다.

## 응답 헤더 vs 액세스 로그

| 출력 | 대상 | 비고 |
| --- | --- | --- |
| `X-Response-Time` | 브라우저, API 게이트웨이, 테스트 | 라우트 변경과 무관하게 사이트 전역 동일 |
| 액세스 로그 `duration` | 로그 플랫폼, 알림, 라우트별 집계 | [HTTP 액세스 로그](/ko/plugins/http-access-log) 참고 |

옵션 표는 없습니다. **헤더가 필요하면 마운트, 아니면 생략.** 보통 `routers` 앞, 액세스 로그 근처.

| 환경 | 권장 |
| --- | --- |
| 프로덕션 | `httpAccessLog()`와 함께 두는 경우 많음 |
| 로컬 | 콘솔만 tail한다면 액세스 로그만으로도 충분할 수 있음 |

`X-Response-Time`은 end-to-end가 아닙니다. 게이트웨이·TLS·클라이언트 큐가 앞에 있습니다. 공개 API면 엣지에서 헤더를 제거할 수 있습니다. `responseTime`만 켜고 로그를 안 남기면 피크 장애 때 집계 `duration`이 여전히 필요합니다([HTTP 액세스 로그](/ko/plugins/http-access-log)).

## 다음 단계

- 액세스 로그: [HTTP 액세스 로그](/ko/plugins/http-access-log)
- 분산 추적: [비동기 추적](/ko/plugins/async-trace)
- [미들웨어](/ko/core/middleware)