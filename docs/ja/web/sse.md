---
outline: deep
---

# サーバープッシュ SSE

「サーバーが継続 push、ブラウザは EventSource で受信」する GET API：action で `ctx.sse()`、`stream` または `send` でイベント送出。通知、進捗、相場更新向け。双方向の雑多フレームは WebSocket を検討。

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
`stream` 優先：クライアント切断で signal が abort、イテレーション終了で自動後片付け。close / タイマー掃除を手書きしにくくする。

`ctx.sse()` と `ctx.response.sse()` は同等。**レスポンスヘッダ未送出前**に呼ぶこと。後だと throw。SSE はレスポンス全体を占有。同じルート末尾で JSON send しない。開始後 200、Content-Type: text/event-stream。emit/send の data がオブジェクトなら JSON 化。lastEventId はリクエストヘッダから。初回接続はだいたい undefined。

## heartbeat と retry

長接続はリバプロにアイドル切断されやすい。**heartbeat** でコメント行を定期送出。**retry** はクライアントの再接続間隔（接続確立時の SSE オプション）。ローカル短時間テストは heartbeat OFF 可。Nginx/CDN 経由本番は両方要確認。

Nginx/CDN 経由で保活。ローカル短テストは heartbeat オフ可：

```typescript
const sse = ctx.sse({
  heartbeat: 10_000,
  retry: 3_000,
});
```
| オプション | デフォルト/習慣 | いつ |
| --- | --- | --- |
| `heartbeat` | だいたい15s | Nginx/CDN 長接続。ローカル短テスト `heartbeat: false` |
| `retry` | 未設定 | ブラウザ再接続 ms（通知で `3000` など） |

## 単一イベントフィールド

各 `send` / `emit` で event 名、id、任意 retry、data。オブジェクト data は自動 JSON。**id** 設定時、再接続は `Last-Event-ID` 付きで続き可能。

| フィールド | いつ |
| --- | --- |
| `data` | ペイロード。オブジェクトは自動 JSON |
| `event` | 複数イベント共存（`job` / `progress` / `ready`） |
| `id` | 断線続き。再接続で `Last-Event-ID` |
| `retry` | 1イベントだけ再接続間隔を変える |

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
## stream、続き、後片付け

`stream` は「上流を読みながら emit」をライフサイクル化。クライアント切断で **signal** abort、終了時に後片付け。タイマーと close を手書きしなくてよい。`lastEventId` はヘッダ由来。その id 以降を再送。`onClose` で購読解放・監査。

```typescript
await sse.stream(async (emit, signal) => {
  // emit 等同 sse.send；signal 断开即 abort
});
```
| メンバー | 典型用法 |
| --- | --- |
| `lastEventId` | その id 以降を push |
| `signal` | Redis 購読、キュー watch に渡す。クライアント離脱で上流も止める |
| `onClose(fn)` | 購読解放、監査 |
| `close()` | タスク完了で能動クローズ。`stream` 終了時は自動 |

```typescript
const after = sse.lastEventId; // [!code highlight]
sse.onClose(() => {
  subscription.unsubscribe();
});
sse.close();
```
接続済みで書けないとき send は黙って無視——「必ず届く」と思わない。断線続きには安定 id。なければ lastEventId が合わず先頭から。

::: warning
Nginx 等の長接続ではフレームワークの X-Accel-Buffering: no 以外に heartbeat とリバプロバッファ/アイドルタイムアウトも要確認。アイドル切断されやすい。
:::

## response()、OpenAPI

OpenAPI はこの GET が `text/event-stream` であることを知る必要がある。mount に `response({ contentType: 'text/event-stream', ... })`。ドキュメントと型用。**action の `ctx.sse()` フレーム書き込みの代わりにはならない**。

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
ドキュメントと型だけ。**`ctx.sse()` のフレームプロトコルは代替できない**。圧縮ミドルウェアはだいたい text/event-stream をスキップ。[Compress](/ja/plugins/compress)。

EventSource は GET のみ。クロスサイト cookie なら [CORS](/ja/plugins/cors) を正しく。

## 次のステップ

- [レスポンス制約](/ja/web/response)（ストリーム contentType）
- [入出力概要](/ja/web/)（他 Web ミドルウェアと併用）
- [Compress](/ja/plugins/compress)（イベント流を壊さない）
