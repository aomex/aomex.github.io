---
outline: deep
---

# サーバープッシュ SSE

「サーバーが継続的に押し、ブラウザが EventSource で聴く」GET API を一本作る。action で ctx.sse() を呼び、stream または send でイベントを出す。通知、進捗バー、相場更新向け。双方向で雑多なフレームなら WebSocket を検討。

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

優先は stream：クライアント切断で signal が abort し、反復終了で自動後始末。close / タイマー掃除を大量に書かなくてよい。

`ctx.sse()` と `ctx.response.sse()` は等価。**まだ応答ヘッダーを書いていない**ときに呼ぶ。さもないとすぐ例外。SSE は応答全体を占有する。同じルート末尾でさらに ctx.send JSON しない。開いたあとステータス 200、Content-Type: text/event-stream。emit / send の data にオブジェクトを渡すと JSON シリアライズ。lastEventId はリクエストヘッダー由来で、初回接続はだいたい undefined。

## heartbeat と retry

ブラウザの長接続は反代にアイドルと判断され切られやすい。`heartbeat` は周期的にコメント行を押し保活する（よくあるのは約 15s。ローカルの短い試験は `heartbeat: false`）。`retry` はクライアントに、切断後何ミリ秒で再接続するかを勧める（通知ストリームはよく `3000`）。Nginx、CDN 経由の本番ストリームでは両方を確認する。

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```

## 単一イベントのフィールド

毎回の `send` / `emit` に event 名、id、任意の単発 retry、および data ペイロードを付けられる。オブジェクト型 data は自動 JSON シリアライズ。**id** を付けるとブラウザ再接続時に `Last-Event-ID` が付き、続きから押しやすい。複数イベントが同居するとき（`job` / `progress` / `ready`）はフロントが `event` 名で聴く。

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

## stream、続き、後始末

`stream` は「上流を読みながら emit」を一段のライフサイクルに包む。クライアント切断で **signal** が abort（Redis 購読やキュー watch に渡す）。反復終了で後始末し、タイマーと close を手書きしなくてよい。`lastEventId` はリクエストヘッダー由来。あるイベント以降から続きを押すのに使う。`onClose` で購読解放や監査。タスク終了で能動的に `close()` してもよい（`stream` 終了で自動呼び出し）。

```typescript
await sse.stream(async (emit, signal) => { // [!code focus:8]
  const after = sse.lastEventId;
  sse.onClose(() => {
    subscription.unsubscribe();
  });
  for await (const item of watchEvents({ after, signal })) {
    emit({ id: String(item.id), event: 'item', data: item });
  }
});
```


接続が閉じているか書けないとき、send は黙って無視する——「必ず届いた」と思わない。切断後の続きが要るならイベントに安定した id を付ける。さもないと lastEventId が合わず、再接続が先頭からになる。

::: warning
長接続が Nginx などの反代を通るとき、フレームワークの X-Accel-Buffering: no 以外に、心拍と反代のバッファタイムアウトも設定を合わせる。さもないとアイドルと判断され切られやすい。
:::

## response()、OpenAPI との関係

OpenAPI はこの GET 出口が `text/event-stream` だと知る必要があるので、mount に `response({ contentType: 'text/event-stream', ... })` を載せる。これはドキュメントと型のためのもの。action 内の `ctx.sse()` によるフレーム書き込みの**代わりにはならない**。

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

これはドキュメントと型ヒントを助けるだけで、`ctx.sse()` のフレームプロトコルの**代わりにはならない**。圧縮ミドルウェアは通常 text/event-stream をスキップする。[Compress](/ja/plugins/compress) を参照。

EventSource は GET のみ。クロスサイトで cookie を付けるときは [CORS](/ja/plugins/cors) を正しく設定する。

## 次のステップ

- [制約付きレスポンス](/ja/web/response)（ストリーム出口の contentType 宣言）
- [入出力の概観](/ja/web/)（ほかの Web ミドルウェアと一緒にマウント）
- [Compress](/ja/plugins/compress)（イベントストリームを壊さない）
