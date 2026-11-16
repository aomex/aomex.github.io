---
outline: deep
---

# 정적 파일

디스크 디렉터리(프론트 `dist`, `public`, 다운로드)를 HTTP 파일 응답에 매핑합니다. miss 시 `next()`로 API 라우트. 선택한 `root`만—프로젝트 루트나 `node_modules` 아님.

```bash
pnpm add @aomex/serve-static
```

## API 라우트 앞

정적 미들웨어는 보통 비즈니스 라우트 **앞**(파일 먼저, 없으면 API).

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

일반 `WebMiddleware`. hit이면 파일, miss면 통과. 경로 traversal, `..`, NUL, dotfile은 패키지 내부 검증으로 거부.

## root와 캐싱

| 옵션 | 언제 쓰나 | 기본값 |
| --- | --- | --- |
| `root` | 프론트 빌드 또는 다운로드 디렉터리 | **필수** |
| `formatPath` | URL prefix가 디스크와 다름(예: `/assets`) | — |
| `indexFile` | 디렉터리 요청 시 index 폴백 | `index.html` |
| `useCompressedFile` | `.br`/`.gz` 사이드카 | `true` |
| `cacheControl` | 해시 청크 장캐시; HTML은 짧게/`noCache` | `maxAge: 0` |

### 장캐시(해시 청크)

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

### URL prefix 재작성

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

### API + SPA 폴백(딥링크 → index.html)

```typescript
import { middleware } from '@aomex/common';
import { send, serveStatic } from '@aomex/serve-static';

mount: [
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
  middleware.web(async (ctx) => {
    const ok = await send(ctx, {
      root: './dist',
      formatPath: () => { // [!code highlight]
        return '/index.html';
      },
    });
    if (!ok) {
      ctx.throw(404);
    }
  }),
];
```

| 환경 | 권장 |
| --- | --- |
| 프로덕션 | 트래픽 크면 CDN/Nginx; Node는 폴백·내부용 |
| 로컬 | `serveStatic`을 Vite 빌드 출력에 |

::: warning
`root: '.'`이나 `node_modules` 포함 디렉터리는 경로 유출 위험—프로덕션 설정 실수가 있습니다.
:::

`index.html`에 해시 청크와 같은 `immutable` 장캐시를 주지 마세요. SPA 딥링크는 위 demo처럼 `routers` 뒤 `index.html` 폴백이 필요합니다.

## 다음 단계

- 조건부 캐시: [ETag](/ko/plugins/etag)
- 전송 압축: [Compress](/ko/plugins/compress)
- Web 조립: [앱 엔트리](/ko/web/)