---
outline: deep
---

# Web 앱 진입점

HTTP 서비스를 띄우려면 [combineServices](/ko/core/service)로 services와 logger를 준비하고, `new WebApp`에 필수 항목을 채운 뒤 `routers('./src/routers')`로 라우트를 겁니다. 아래에서는 사이트 언어, 클라이언트 IP, 요청 본문 상한, 라우트의 ctx.send / ctx.throw / ctx.redirect 사용도 함께 설명합니다.

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

업무 서비스는 [combineServices](/ko/core/service)로 등록하고, WebApp에는 그 반환값과 대응하는 logger 인스턴스를 넘겨야 합니다.

```typescript
// src/services/index.ts
import { combineServices } from '@aomex/common';

export const services = await combineServices(
  { logger: () => import('./logger.service.js') },
  { eager: ['logger'] }, // [!code highlight]
);
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP 服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

`new WebApp({ ... })`에서 services, logger, language, proxyIP 중 하나라도 빠지면 컴파일러가 바로 오류를 냅니다. 전역 mount에서 `middleware.web`로 ctx에 필드를 달아놓고 위의 `declare module`을 안 쓰면 런타임에는 값이 있어도 타입에는 없어서 업무 코드 곳곳에서 `as`를 쓰게 됩니다. 라우트에 [response()](/ko/web/response)를 걸면 ctx.send / ctx.throw body 형태가 선언에 맞게 좁혀집니다.

::: warning
전역 mount로 ctx에 필드를 달았는데 `declare module`이 없으면, 런타임에는 값이 있어도 타입에는 없어 업무에서 `as`를 남발하기 쉽습니다.
:::

```bash
node --import tsx/esm --watch src/web.ts
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열면 됩니다. 시작 명령은 package.json scripts에 넣어 팀이 `pnpm start`로 통일하는 것을 권장합니다.

아래 필드는 모두 `new WebApp({ ... })` 안에서 조정합니다. 라우트는 «이 경로가 무엇을 하는지», 여기서는 «사이트 전체가 어떻게 도는지»를 다룹니다.

## services와 logger

`services`는 업무 서비스 컨테이너(DB, 캐시, 발송 등이 여기에 붙습니다). [combineServices](/ko/core/service)로 조립해 WebApp에 넘깁니다. 프로세스 종료 시 프레임워크는 destroy 단계에서 로드된 서비스의 `destroy`를 호출해 연결 종료·로그 flush 등을 합니다.

`logger`는 별도로 한 번 더 넘겨야 합니다(보통 `services.logger`). 라우트·미들웨어의 `ctx.logger`가 이 인스턴스이며, 생성 인자와 같은 참조입니다.

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

**body() / query() 검증 실패·프레임워크 내장 메시지**에 쓸 언어를 정합니다. 언어 코드는 `zh-CN`, `en-US`처럼 하이픈을 쓰고 `zh_CN`은 쓰지 마세요. 프레임워크 쪽 문구만이며, Ant Design / Day.js locale이나 업무 번역 키는 아닙니다. 업무 다국어는 [고급: 업무 i18n](/ko/advanced/i18n)을 보세요.

| 모드 | 언제 쓰나 |
| --- | --- |
| `fixed` + `language` | 내부망 백오피스, 단일 언어 SaaS. 요청 헤더를 읽을 필요 없음 |
| `dynamic` | 공개 멀티 클라이언트 API, 요청 협상 |
| `header: 'accept-language'` | 브라우저, 표준 클라이언트(RFC `q` 정렬) |
| `header: 'x-language'` | 앱 커스텀 헤더(쉼표 구분, 보통 `q` 무시) |
| `fallback` | 헤더 없거나 모를 때 대체 |

고정 언어:

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

Accept-Language 협상:

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

커스텀 헤더:

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

자체 테스트:

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
너무 늦은 미들웨어에서 언어를 정하지 마세요. 그 앞의 body() / query()가 이미 기본어로 오류를 냈을 수 있습니다. WebApp.language에 맡겨야 프레임워크 문구 전체를 덮습니다. Console 쪽은 문자열만 고정 가능합니다. [Console 앱 진입점](/ko/console/#language).
:::

## proxyIP

`ctx.request.ip`를 채웁니다. 잘못 맞추면 레이트 리밋·리스크 통제가 잘못된 주체를 봅니다.

| 모드 | 언제 쓰나 |
| --- | --- |
| `detect` | 로컬 `tsx`, 단위 테스트. 앞에 프록시가 있는지 불확실할 때 일단 통과 |
| `specify` | 공개 프로덕션. 자사 프록시가 쓴 헤더만 믿어 클라이언트 위조 `X-Forwarded-For` 방지 |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
공개 프로덕션에서 detect를 장기간 쓰지 마세요. 클라이언트가 흔한 프록시 헤더를 위조할 수 있어 레이트 리밋·감사가 잘못된 사람을 봅니다. 배포 시 specify로 바꾸고 자사 프록시 헤더만 믿으세요.
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

hops는 실제 프록시 층 수와 같아야 합니다. 아니면 이전 홉 내부 주소나 CDN 노드를 읽어 이상 로그인 알림 등 리스크 통제가 틀어집니다.

| 토폴로지 | 흔한 설정 |
| --- | --- |
| Node 공개 직결 / 개발기 직결 | `detect` 또는 프록시 헤더 안 읽는 `specify` |
| 단층 Nginx → Node | `specify` + `x-forwarded-for`, `hops: 1` |
| CDN + 자사 Nginx | `x-forwarded-for`, `hops: 2`(실제 층에 맞게) |
| Cloudflare만 경유 | `specify` + `cf-connecting-ip`, `hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount`는 사이트 미들웨어 큐입니다. 요청마다 배열 순서대로 들어가며(양파 모델, `await next()` 전후 작업 가능). CORS, 사이트 인증, 접근 로그, `routers('./src/routers')`로 스캔한 API가 여기에 겁니다.

특정 URL 묶음만 영향을 주는 로직은 [Router](/ko/web/router)나 단일 라우트 mount에 두고 WebApp에 전부 넣지 마세요.

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

프로세스가 `SIGTERM` / `SIGINT`를 받으면(`docker stop`, Ctrl+C, K8s 롤링 등) WebApp은 **graceful shutdown**을 합니다. 새 연결을 받지 않고, 처리 중 요청이 끝나길 기다린 뒤 services를 destroy하고 종료 코드 0으로 끝냅니다.

`timeout`은 최대 대기 시간(기본 약 **5초**, ms 또는 `'10s'` 문자열 가능). 시간이 지나도 연결이 남으면 강제 종료해 배포가 멈추지 않게 합니다.

```typescript
shutdown: { timeout: 10_000 },
```

로컬 개발에서는 거의 안 바꿉니다. 프로덕션에서 업로드·장 폴링·느린 쿼리가 있으면 최악 요청 시간에 맞춰 키우세요. shutdown 중 새 요청은 들어오지 않습니다. 로드밸런서가 시그널 전에 인스턴스를 빼야 합니다.

## body 사이트 할당량

업로드 API나 큰 JSON 웹훅을 열기 전 기본값이 충분한지 보고, 부족하면 앱 수준에서 조이거나 넓히세요.

| 종류 | 대표 Content-Type | 기본(참고) |
| --- | --- | --- |
| `payload` | JSON, urlencoded, text 등 전체 메모리 적재 | 약 `2mb`, 초과 **413** |
| `formData` | `multipart/form-data` | 파일당 약 `50mb`, 파일·필드 수 상한 |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```

라우트 [body()](/ko/web/body)에 파일 필드가 있으면 앱 formData 상한과 **더 엄격한 쪽**을 따릅니다. 업로드 세부는 [파일 업로드](/ko/web/attach).

웹훅·큰 JSON 전 기본 할당량을 보세요. 전체가 먼저 메모리로 들어가며 초과는 **413**이고 검증 실패 **400**과 다릅니다. 라우트만 바꾸고 앱 `body.payload`를 안 바꾸는 경우가 많습니다.

## envelope

성공·실패가 **같은 JSON 껍데기**이고 바깥 HTTP는 **200**(실제 상태는 body)이면 `new WebApp`에 `envelope`를 씁니다. 라우트는 그대로 `send` / `throw`하고, 프레임워크가 쓰기 전에 래핑합니다.

`envelope.success` / `envelope.payload` / `envelope.statusCode`와 선택적 `envelope.slot`로 트리를 만들며, [formatError](/ko/web/errors)와 자주 함께 씁니다. 예외(리다이렉트, 204, SSE 등)는 [응답 본문 래핑](/ko/web/envelope).

## listen, http, https

`listen`이 HTTP를 포트에 실제로 바인딩합니다. 호출하지 않으면 App 객체만 있고 외부에서 접근할 수 없습니다. `app.listen(port)`는 `app.http({}).listen(port)`와 같고 평문 HTTP입니다.

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```

프로덕션에서는 Nginx / Caddy가 TLS를 끝내고 Node HTTP로 리버스 프록시하는 경우가 많습니다. 이때 proxyIP도 맞추세요.

## ctx.send

라우트 action이나 전역 미들웨어에서 상태 코드를 생략하면 기본 **200**입니다. 201, 204 등은 첫 인자로 명시하세요.

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```

## ctx.throw

**4xx / 5xx만** 쓰세요. 업무 거절은 ctx.throw이고 `throw new Error`가 아닙니다. 공개 4xx는 5xx처럼 더러운 로그를 만들지 않습니다.

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```

`expose: true`이면 응답에 message가 노출됩니다. SQL·내부 경로를 넣지 마세요.

## ctx.redirect

영구 **301**, 임시는 **302**가 흔하고 상태 생략 시 기본 302입니다.

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```

## download, sse, logger

라우트에서 쓰는 다른 출구입니다. 전용 문서가 자세히 설명합니다:

- `ctx.download`: 파일 스트림을 클라이언트에 씁니다. 스트림이 끝나야 Promise가 settle되어 «받은 뒤 바로 삭제» 임시 파일에 맞습니다.
- `ctx.sse()`: Server-Sent Events. [SSE](/ko/web/sse).
- `ctx.logger`: WebApp 생성 시 넘긴 logger와 같습니다. `requestId` 등은 [로그 · withBindings](/ko/core/logger#요청-범위-컨텍스트-withbindings).

### app.on('error')

action / 미들웨어에서 잡히지 않은 예외는 프레임워크가 `emit('error', err, ctx)`합니다. 기본은 `expose`에 따라 `logger.error` 여부가 정해지고, 여기에 리스너를 달아 Sentry·슬랙 등 부가 알림에 씁니다.

**여기서 응답 body를 바꾸지 마세요.** 시점이 늦어 이미 쓴 응답과 충돌합니다. 사이트 JSON 오류 형태는 [formatError](/ko/web/errors), 성공·실패 같은 껍데기·바깥 200은 [응답 본문 래핑](/ko/web/envelope).

## 다음 단계

- [API 라우트](/ko/web/router): URL·HTTP 동사별 파일 분리
- [query](/ko/web/query) / [params](/ko/web/params) / [body](/ko/web/body): 입력 검증 3종
- [응답 제약](/ko/web/response): TypeScript와 OpenAPI 맞추기
- [서버 전송 SSE](/ko/web/sse): ctx.sse / stream / 끊김 이어받기
- [오류 형식](/ko/web/errors): `ctx.throw` 이후 JSON 오류 body
- [응답 본문 래핑](/ko/web/envelope): 통일 JSON 껍데기, 바깥 HTTP 200
