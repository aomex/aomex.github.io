---
outline: deep
---

# ETag

성공한 GET/HEAD에 entity tag를 계산합니다. 클라이언트가 `If-None-Match`를 보내고 내용이 같으면 **304**로 대역폭을 아낍니다. 준정적 설정·버전 정보에 좋고, 개인화된 목록에는 이득이 적습니다.

```bash
pnpm add @aomex/etag
```

## WebApp에 마운트

`WebApp.mount`에 `etag()`—성공 GET/HEAD에 ETag 자동. `If-None-Match` 일치·내용 동일 시 304. 핸들러는 여전히 `ctx.send`.

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

핸들러는 `ctx.send(data)`; 태그 일치·신선하면 미들웨어가 빈 본문 304를 반환합니다.

일반 `WebMiddleware`—새 `ctx` 필드 없음. 첫 응답에 ETag; 같은 `If-None-Match` 재요청 → **304**. 기존 `Etag` 헤더, 비 2xx, GET/HEAD 아니면 보통 재작성 안 함.

::: tip
사이트에 [응답 본문 래핑](/ko/web/envelope)을 켠 경우, 래핑이 body를 바꾸고 바깥을 200으로 맞춥니다. 프레임워크는 **기존 ETag를 제거**해 요약이 래핑 전 내용을 가리키지 않게 합니다. 조건부 캐시가 필요한 API는 요약이 래핑 이후인지 확인하거나, 해당 출구에 `skipEnvelope`를 쓰세요.
:::

## 약한 검증과 스태킹

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `weak` | 의미상 동일이면 304; strong은 바이트 동일 | `false` (`ReadStream`은 often weak) |

```typescript
mount: [etag({ weak: true })];
```

### 준정적 API(프로덕션에서 often 켬)

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### 정적 자산 + 압축

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| 환경 | 권장 |
| --- | --- |
| 프로덕션 | 정적·준정적 엔드포인트에 켜기; 사이트 전체 강제는 스킵 |
| 로컬 | 디버그용으로 켜거나 끄기 |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

대규모에서는 CDN 캐시가 먼저일 수 있습니다. 앱 ETag는 304 의미를 여전히 제어할 때 도움됩니다. 코드만 바뀌고 데이터가 안 바뀌면 ETag가 안 바뀔 수 있으니 실요청으로 304를 확인하세요.

## 다음 단계

- 조건부 캐시: [정적 파일 제공](/ko/plugins/serve-static)
- 전송 압축: [Compress](/ko/plugins/compress)
- [Web 앱](/ko/web/)