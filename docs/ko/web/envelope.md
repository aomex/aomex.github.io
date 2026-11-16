---
outline: deep
---

# 응답 본문 래핑

많은 팀은 **성공·실패 모두 같은 JSON 껍데기**(`{ success, data, statusCode }` 등)를 쓰고, 바깥 HTTP는 **200**으로 고정한 뒤 실제 상태 코드는 body에 씁니다. `WebApp.envelope`가 바로 이 역할을 합니다. 응답이 실제로 나가기 전에 원래 body와 상태 코드를 선언한 구조로 한 겹 감쌉니다.

라우트에서는 여전히 `ctx.send(201, …)` / `ctx.throw(400, …)`를 쓰면 됩니다. 래핑은 flush 단계에서 일어나므로 action마다 껍데기를 손으로 쓸 필요가 없습니다.

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/ko/web/)
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
    formatError({
      content: { code: rule.string(), message: rule.string() },
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

설정 후:

- `ctx.send(201, { id: 1 })` → HTTP **200**, body는 `{ success: true, statusCode: 201, data: { id: 1 } }` 비슷
- `ctx.throw(400, …)`(formatError와 함께) → HTTP **200**, `success: false`, `data`에 오류 JSON. 실제 **400**은 `statusCode` 슬롯

클라이언트는 body의 성공 여부를 봐야 하며 **HTTP 상태 코드만으로는 판단하면 안 됩니다**(리다이렉트·본문 없는 응답은 아래 예외).

## 내장 슬롯

`content`는 선언 트리이고, 리프는 내장 슬롯 또는 `envelope.slot`, 또는 중첩 일반 객체일 수 있습니다. `rule.string()`을 직접 넣지 마세요. 런타임에 값을 꺼낼 출처가 없습니다.

| 슬롯 | 런타임 의미 |
| --- | --- |
| `envelope.success` | 원래 상태 코드가 `` `< 400` ``인지(업무상 성공인지) |
| `envelope.payload` | 래핑 전 응답 body(json / string / null) |
| `envelope.statusCode` | 래핑 전 HTTP 상태 코드(출력 후 바깥은 여전히 200) |

키 이름을 `data`, `result`, `payload` 중 무엇으로 할지는 자유입니다. 내장 슬롯을 어느 키에 걸지 정하면 됩니다.

## 사용자 슬롯과 중첩

버전, 추적 필드 같은 고정·파생 값이 필요하면 `envelope.slot(schema, get)`을 씁니다. `schema`는 OpenAPI용, `get`은 `{ success, payload, statusCode }`만 읽습니다.

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

`get` 안에서는 ctx, services 같은 다른 컨텍스트에 의존하지 마세요. 래핑 단계에서는 위 세 변수만 보입니다.

## formatError, response()와의 관계

- **[formatError](/ko/web/errors)**: `ctx.throw`를 먼저 통일된 오류 JSON으로 모은 뒤 `envelope.payload`로 넣습니다. 함께 두는 것을 권장합니다. formatError 없으면 기본 순 텍스트 오류도 payload에 들어가며(JSON 문자열 값으로).
- **[response()](/ko/web/response)**: «실제» 상태 코드 기준으로 성공·실패 body 형태를 선언합니다. 래핑은 action의 send/throw 방식을 바꾸지 않고 쓰기 직전 껍데기만 바꿉니다. OpenAPI에서는 성공·실패 분기가 200 아래 래핑 schema로 모입니다(아래 참고).

업무 코드는 `send(201)`, `throw(404)`를 그대로 쓰고, 타입·라우트 선언을 «항상 200»으로 바꿀 필요는 없습니다.

## 래핑하지 않는 경우

다음 응답은 **원문 그대로** 나가며, 껍데기도 없고 200으로 바꾸지도 않습니다:

| 경우 | 이유 |
| --- | --- |
| **3xx** 리다이렉트 | Location 등 의미를 JSON 껍데기로 바꿀 수 없음 |
| **204 / 205 / 304** 등 본문 없음 | body 자체가 없음 |
| **SSE**(`text/event-stream`) | 스트리밍 프레임 프로토콜, 통째로 JSON 버퍼 불가 |
| **Buffer / Stream** body | 바이너리·스트리밍 다운로드, JSON 래핑 부적합 |

일반 json / string / null(명시적 send 없는 기본 404 포함)은 래핑됩니다.

## OpenAPI

`generateOpenapi` / Console `openapi()`에 **envelope가 설정된 같은 `WebApp`(`app`)**을 넘기면, 생성기는 `app`의 래핑 설정을 읽습니다. 다른 `response` / `formatError` 주입 후 문서의 2xx와 4xx·5xx·default를 **HTTP 200** 래핑 schema로 모읍니다(성공·실패는 보통 `oneOf`, `success`는 `true` / `false` 고정). **3xx**와 204 등 본문 없음 상태 코드는 런타임 스킵 규칙과 같이 **유지**합니다.

`envelope.description`은 모인 `200` 응답 설명에 씁니다. `mount` 배열을 또 손으로 넘기지 말고 `app`을 빼먹지도 마세요. 그렇지 않으면 계약은 «201 + 맨 body»인데 실서비스는 «200 + 껍데기»가 됩니다. 자세히는 [OpenAPI 생성](/ko/plugins/openapi).

## 다음 단계

- [오류 형식](/ko/web/errors): `formatError`와 래핑 payload
- [응답 제약](/ko/web/response): 라우트별 실제 상태 코드와 안쪽 content
- [OpenAPI 생성](/ko/plugins/openapi): 계약이 라우트를 어떻게 스캔하는지
- [Web 앱 진입점](/ko/web/): `WebApp` 기타 필수 항목
