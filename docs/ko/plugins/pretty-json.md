---
outline: deep
---

# Pretty JSON

개발 중 브라우저에 **들여쓴 JSON**을 보여 줍니다(한 줄 대신). 프로덕션은 끄는 편이 좋습니다—응답 크기가 커지고(특히 모바일), 공개 API가 쿼리 스위치에 의존해 본문을 키우면 안 됩니다.

```bash
pnpm add @aomex/pretty-json
```

## 개발용 마운트

`prettyJson()`은 `await next()` **이후**에 실행되어 JSON 응답을 들여쓴 텍스트로 바꿉니다. `WebApp.mount`에 추가하세요. 프로덕션은 `enable: false` 또는 `?pretty`만 쓰세요.

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

일반 `WebMiddleware`이며 추가 `ctx` 필드는 없습니다. `Content-Type`이 JSON인 동안 본문은 읽기 쉬운 `JSON.stringify(..., null, spaces)`가 되고, object-mode readable stream은 스트리밍 stringify를 씁니다.

## `enable`과 `query` 스위치

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `enable` | 프로덕션은 반드시 `false`; 내부 디버그 도구만 선택 | `true` |
| `query` | 사이트 전역 pretty 없이 `?pretty`일 때만 | — |
| `spaces` | 팀 선호 2 vs 4칸 | `2` |

### 내부 / 온디맨드만

```typescript
prettyJson({ spaces: 4 });
```

### 내부 / 온디맨드만

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| 환경 | 권장 |
| --- | --- |
| 로컬 | `enable: true` 또는 `?pretty`만 |
| 프로덕션 | `enable: false`; 공개 라우트가 쿼리로 본문 키우지 않게 |

큰 목록을 pretty 하면 compact JSON 대비 수 배 커질 수 있습니다. [Compress](/ko/plugins/compress)와 함께 써도 pretty는 본문을 길게 만듭니다.

## 다음 단계

- JSON 응답 형태: [응답 제약](/ko/web/response)
- 페이로드 축소: [Compress](/ko/plugins/compress)
- 개발 API UI: [Swagger UI](/ko/plugins/swagger-ui)