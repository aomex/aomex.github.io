---
outline: deep
---

# 서버 전송 SSE

«서버가 계속 밀어 주고, 브라우저는 EventSource로 듣는» GET API를 만들려면 action에서 `ctx.sse()`를 호출하고 stream 또는 send로 이벤트를 내보냅니다. 알림, 진행률, 시세 갱신에 적합하고, 양방향 잡다한 프레임이 필요하면 WebSocket을 고려하세요.

```typescript
import { Router } from '@aomex/web';

export const router = new Router();

router.get('/events', { // [!code focus:13]
  action: async (ctx) => {
    const sse = ctx.sse({ retry: 3_000 }); // [!code highlight]
    await sse.stream(async (emit, signal) => {
      for await (const item of watchEvents({
        after: sse.lastEventId,
        signal,
      })) {
        emit({ id: String(item.id), event: 'item', data: item });
      }
    });
  },
});
```

stream을 우선하세요. 클라이언트가 끊기면 signal이 abort되고, 이터레이션이 끝나면 자동으로 정리되어 close / 타이머 정리 코드를 덜 씁니다.

`ctx.sse()`와 `ctx.response.sse()`는 같습니다. **응답 헤더를 아직 안 썼을** 때만 호출하세요. 그렇지 않으면 바로 오류입니다. SSE는 응답 전체를 차지하므로 같은 라우트 끝에서 `ctx.send` JSON을 또 쓰지 마세요. 연 후 상태 코드 200, Content-Type: text/event-stream입니다. emit / send의 data에 객체를 넘기면 JSON 직렬화됩니다. lastEventId는 요청 헤더에서 오며 첫 연결은 대개 undefined입니다.

## heartbeat와 retry

브라우저 장연결은 리버스 프록시가 유휴로 끊기 쉽습니다. **heartbeat**는 주기적으로 주석 줄을 밀어 살아 있게 하고, **retry**는 클라이언트가 끊긴 뒤 몇 ms 뒤 재연결할지 제안합니다(SSE 옵션, 연결 시점에). 로컬 짧은 테스트에서는 heartbeat를 끌 수 있고, Nginx·CDN을 거치는 프로덕션 스트림은 둘 다 맞춰 보세요.

Nginx·CDN 경유 장연결 유지. 로컬 짧은 테스트는 heartbeat 끄기:

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

| 옵션 | 기본 / 관습 | 언제 쓰나 |
| --- | --- | --- |
| `heartbeat` | 보통 약 15s | Nginx·CDN 장연결. 로컬 짧은 테스트는 `heartbeat: false` |
| `retry` | 미설정 | 브라우저가 ms 간격으로 재연결하게(알림 스트림은 `3000` 자주) |

## 단일 이벤트 필드

`send` / `emit`마다 event 이름, id, 선택적 단건 retry, data 페이로드를 줄 수 있습니다. 객체 data는 자동 JSON 직렬화됩니다. **id**를 두면 재연결 시 `Last-Event-ID`가 붙어 이어받기가 쉽습니다.

| 필드 | 언제 쓰나 |
| --- | --- |
| `data` | 페이로드. 객체는 자동 JSON |
| `event` | 여러 이벤트 공존(`job` / `progress` / `ready`), 프론트가 이름으로 구독 |
| `id` | 끊김 이어받기. 재연결에 `Last-Event-ID` |
| `retry` | 한 이벤트에서만 재연결 간격 잠시 변경 |

```typescript
sse.send({ data: { hello: 'world' } });
sse.send({ event: 'ready' });
sse.send({
  id: '42', // [!code highlight]
  event: 'job',
  retry: 5_000,
  data: 1,
});
```

## stream, 이어받기, 마무리

`stream`은 upstream을 읽으며 emit하는 구간을 한 생명주기로 감쌉니다. 클라이언트가 끊기면 **signal** abort, 이터레이션이 끝나면 정리되어 타이머·close를 손으로 덜 씁니다. `lastEventId`는 요청 헤더에서 와서 그 id 이후부터 밀 수 있습니다. `onClose`에서 구독 해제·감사 로그를 남깁니다.

```typescript
await sse.stream(async (emit, signal) => {
  // emit 等同 sse.send；signal 断开即 abort
});
```

| 멤버 | 흔한 쓰임 |
| --- | --- |
| `lastEventId` | 이 id 이후부터 전송 |
| `signal` | Redis 구독, 큐 watch에 넘김. 클라이언트가 끊기면 upstream도 중지 |
| `onClose(fn)` | 구독 해제, 감사 |
| `close()` | 작업 끝에 스트림 닫기. `stream` 종료 시 자동 호출 |

```typescript
const after = sse.lastEventId; // [!code highlight]
sse.onClose(() => {
  subscription.unsubscribe();
});
sse.close();
```

연결이 닫혔거나 쓸 수 없으면 send는 조용히 무시됩니다. «반드시 전달»로 여기지 마세요. 끊김 이어받기를 하려면 이벤트에 안정적인 id를 두세요. 없으면 lastEventId가 맞지 않아 재연결 시 처음부터 다시 갑니다.

::: warning
Nginx 등 리버스 프록시 경유 장연결에서는 프레임워크의 X-Accel-Buffering: no 외에 heartbeat와 프록시 버퍼 타임아웃도 맞춰야 유휴로 끊기지 않습니다.
:::

## response(), OpenAPI

OpenAPI는 이 GET 출구가 `text/event-stream`임을 알아야 하므로 mount에 `response({ contentType: 'text/event-stream', ... })`를 겁니다. 문서·타입용이며 action의 `ctx.sse()` 프레임 작성을 **대체하지 않습니다**.

```typescript
import { rule } from '@aomex/common';
import { response } from '@aomex/web';

response({
  statusCode: 200,
  contentType: 'text/event-stream', // [!code highlight]
  content: rule.string(),
  description: 'SSE 事件流',
});
```

문서·타입 힌트만 돕고, `ctx.sse()` 프레임 프로토콜을 **대신하지 않습니다**. 압축 미들웨어는 보통 text/event-stream을 건너뜁니다. [Compress](/ko/plugins/compress) 참고.

EventSource는 GET만 가능하고, 크로스 사이트 cookie가 필요하면 [CORS](/ko/plugins/cors)를 맞추세요.

## 다음 단계

- [응답 제약](/ko/web/response)(스트리밍 출구 contentType 선언)
- [입출력 개요](/ko/web/)(다른 Web 미들웨어와 함께 mount)
- [Compress](/ko/plugins/compress)(이벤트 스트림 압축 방지)
