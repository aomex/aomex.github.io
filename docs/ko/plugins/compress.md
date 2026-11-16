---
outline: deep
---

# 응답 압축

클라이언트가 `Accept-Encoding`을 보낼 때 큰 JSON·리포트 응답을 gzip / br / zstd 등으로 압축해 대역폭을 줄입니다.

**프로덕션에서는 Nginx(또는 CDN) 압축을 우선**—Node CPU를 덜 쓰고 정적 자산·TLS 종료와 맞춥니다. 로컬 직결, 리버스 프록시 없음, 게이트웨이가 아직 인코딩 협상을 못 할 때만 앱 안 `@aomex/compress`를 씁니다. 작은 본문과 이미 압축된 자산(이미지·영상)은 건너뜁니다.

```bash
pnpm add @aomex/compress
```

## WebApp에 마운트

엣지가 **같은 응답을 압축하지 않는다**는 것을 확인한 뒤 `WebApp.mount`에 `compress()`를 둡니다. `await next()` 이후 `Accept-Encoding`으로 압축하며, 핸들러는 `ctx.send`만 하면 되고 action에서 gzip 검사는 필요 없습니다.

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

`compress()`는 `CompressProps`를 추가합니다. 라우트마다 `ctx.needCompress`로 켜거나 끌 수 있습니다(자동완성에 필드가 보입니다). 응답에 `Content-Encoding`이 붙고, `text/event-stream` 같은 스트리밍 타입은 전체 버퍼링을 피하려고 보통 건너뜁니다.

## 임계값과 알고리즘

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `threshold` | 작은 본문은 CPU 절약을 위해 스킵 | `1024` |
| `filter` | 전역으로 압축 불가 MIME 스킵; `ctx.needCompress`로 덮어쓰기 | MIME 기준 |
| `zstd` / `br` / `gzip` / `deflate` | 안 쓰는 알고리즘 끄기 | 전부 활성 |
| `ctx.needCompress` | 라우트별 예외: SSE, 대용량 다운로드 | `filter` 따름 |

클라이언트가 여러 개를 지원하면: **zstd → br → gzip → deflate**.

### 대용량 목록 / 내보내기

```typescript
compress({ threshold: '4kb' });
```

### SSE는 압축 끄기

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

일반적인 순서: 액세스 로그 / 응답 시간 → compress → 라우트(compress는 최종 본문이 필요합니다).

| 환경 | 권장 |
| --- | --- |
| 로컬 Node 직결 | 크기 확인용 `compress()` OK |
| Nginx / CDN 프로덕션 | **엣지에서 압축**; 앱 이중 압축 피하기 |
| 엣지가 아직 못 압축 | 앱 `compress()` + 게이트웨이 중복 모듈 끄기 |

::: tip
Nginx는 often `gzip on;`(필요하면 Brotli 모듈). 게이트웨이 **또는** 앱 중 하나만 고르세요.
:::

::: warning
게이트웨이+앱 압축은 크기가 거의 안 줄고 지연·CPU는 늘기 쉽습니다.
:::

스트리밍 라우트에서 `ctx.needCompress = false` 없이 두면 버퍼링되어 실시간 동작이 깨집니다. [ETag](/ko/plugins/etag)와 함께 쓸 때 304·크기는 실제 요청으로 순서를 확인하세요.

## 다음 단계

- 조건부 캐시: [ETag](/ko/plugins/etag)
- 정적 사전 압축: [정적 파일 제공](/ko/plugins/serve-static)
- 시간 헤더: [응답 시간](/ko/plugins/response-time)