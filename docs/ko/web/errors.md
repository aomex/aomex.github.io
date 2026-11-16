---
outline: deep
---

# 오류 형식

전역(또는 모듈)의 `ctx.throw`를 기본 순 텍스트가 아닌 통일된 JSON 봉투로 만들려면 mount에 `formatError`를 걸고, handler로 최종 body를 정하고, content로 타입과 OpenAPI를 고정하세요. 형태를 바꿀 때는 여기를 쓰고, `app.on('error')`에서 body를 억지로 바꾸지 마세요. 시점이 늦어 이미 쓰인 응답과 충돌하기 쉽습니다.

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/ko/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

`formatError`는 routers **바깥·앞쪽**에 두면, 라우트에서 throw한 것이 더 안쪽에서 잡히지 않는 한 이 handler로 갑니다.

handler 반환 형태는 content와 맞아야 합니다. `ctx.throw(403, { code: 'FORBIDDEN' })`일 때 업무 코드는 보통 `err.code`, 문구는 정제된 `err.message`에 있습니다. statusCodes를 생략하면 이 층이 **모든** 4xx / 5xx를 처리합니다. 라우트에 `response({ statusCode: 400 })`만 있고 content가 없으면 문서 생성 시 바깥 formatError 오류 형태를 빌릴 때가 많습니다. formatError가 없으면 클라이언트는 프레임워크 기본 순 텍스트 오류를 봅니다.

잡을 때 보통 현재 응답에 이미 있던 헤더를 지우고, 오류 코드로 상태를 다시 잡은 뒤 새 body를 send합니다. `err.raw`, 스택, SQL을 handler 반환값에 넣지 마세요. 바깥에는 정제된 정보만 주세요.

## 모듈 안쪽 봉투

전역 formatError가 사이트 기본 형태를 담당합니다. **/admin**이나 공개 API 하위 도메인에서 다른 필드명(`error` / `detail` 대신 `code` / `message`)이 필요하면 해당 `Router({ mount: [formatError(...)] })`에 한 겹 더 겁니다. 양파 안쪽이 먼저 throw를 잡고, 그 prefix 라우트는 안쪽 봉투, 나머지는 바깥을 씁니다.

/admin에서 다른 필드명이 필요하면 Router 안에 한 겹 더:

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```

양파 모델에서 **안쪽이 먼저 catch**합니다. /admin/*는 안쪽 형태, 다른 라우트는 전역 fallback을 씁니다.

## statusCodes 부분 위임

`statusCodes`는 **이 층** formatError가 나열한 HTTP 상태만 처리한다는 뜻입니다(흔히 400, 422 등 검증류만). 다른 4xx / 5xx는 바깥 handler로 계속 올라갑니다. «검증 오류만 JSON 통일, 403은 전역 봉투» 같은 분업에 맞습니다.

검증류만 맡기고 나머지 코드는 바깥에:

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```

## 라우트 throw와 함께

라우트에서 `ctx.throw(status, …)`로 요청을 끊고 오류 체인으로 갑니다. 리소스 없음 **404**, 파라미터 업무 검증 **400**, 권한 **403** 등. 두 번째 인자는 문자열이거나 `code`가 있는 객체일 수 있고, formatError handler는 `err`에서 코드와 문구를 꺼내 content에 넣습니다.

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

업무에서 헤더나 body를 이미 썼다가 throw하면 formatError가 통째로 갈아끼우게 두고, action에서 오류 JSON을 반쯤만 만들지 마세요.

성공·실패 body를 같은 `{ success, data, statusCode }`로 또 감싸고 바깥 HTTP를 200으로 고정하려면 [응답 본문 래핑](/ko/web/envelope)을 보세요(formatError와 자주 함께 씁니다).

## 다음 단계

- [응답 본문 래핑](/ko/web/envelope)(통일 껍데기와 HTTP 200)
- [응답 제약](/ko/web/response)(라우트별 400/404 선언)
- [앱 진입점](/ko/web/)(services / logger / language 등 전역 설정)
- [WebApp.language](/ko/web/#language)(검증·오류 문구 언어)
