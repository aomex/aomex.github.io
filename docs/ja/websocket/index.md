---
outline: deep
---

# WebSocket アプリケーション入口

チャット、注文ステータス、共同カーソル——サーバーからブラウザへ能動的に push する用途向け。WebSocket アプリは Web と同様に `WebsocketApp` を組み、**同じ** HTTP ポートに載せる。接続後はイベント名で業務へ。注文を DB に書いたあと、通常の HTTP ルートから同じ `ws` でオンラインユーザーへ push できる。

先に言っておく：メッセージは**ベストエフォート**。`await ws.room(...).send(...)` の完了は、フレームワークが書き出した（または Redis に渡した）ことまでで、**相手が必ず受け取る保証はない**。自動再送やオフライン受信箱もない。重要データは DB に。クライアントは再接続後に HTTP で漏れを補う。

## 依存関係と最初のインスタンス

動く [Web アプリ](/ja/web/) がある前提。リアルタイム用パッケージを追加：

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` は単独ファイルに置き `export` する。HTTP 入口・ルート・Console はこの一つを import——**各ファイルで `new` しない**。さもないと push と接続がずれる。

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`、`language`、`transport` は必須。欠けるとコンパイルエラー。

- `logger`：Web / Console と**同じ** `Logger`。トランスポート初期化失敗やルーム扇ぎ失敗のログ先。
- `language`：この接続上のフレームワーク文言（握手失敗、不正フレームの close 理由、限流・検証失敗の push）。ここでは `fixed`——管理画面・イントラ・単一言語向け。
- `mount`：まず `channels('./src/channels')`。Web の `routers('./src/routers')` と同型。Channel の書き方は [イベントルート](/ja/websocket/channel)。

公開マルチクライアントで握手ヘッダー協議なら `dynamic` + `fallback`：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` デフォルトは `accept-language`（`q` ソート）。アプリ独自は `x-language`。言語コードは `zh-CN`、`en-US`（ハイフン）。

::: tip
**HTTP ルート**から `ws.room().send()` するときの言語は**その HTTP リクエスト**に従い、長接続握手時の言語ではない。
:::

## HTTP ポートに載せる

WebSocket は単独ポートで listen しない——Web の `http.Server` でプロトコルアップグレードする。入口は `app.listen(3000)` 一発ではなく：`app.http({})` で server 取得 → `ws.attach` → `listen`。

```typescript
// src/web.ts — プロセス起動の入口
import { routers, WebApp } from '@aomex/web';
import { services } from '@/services';
import { ws } from '@/ws';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')],
});

const server = app.http({}); // [!code focus:3]
ws.attach(app, server); // [!code highlight]
server.listen(3000, () => {
  console.log('HTTP + WebSocket 已启动');
});
```

`attach` は `listen` **より前**。同じ `ws` は一度だけ attach、再呼び出しは throw。シャットダウン時は HTTP と同時に WebSocket を排水——二重クリーンアップは不要。

::: warning
`src/ws.ts` のモジュールトップで `ws.attach(...)` を書かない。Console も `ws` を import し、import 時に再 attach するとプロセスごとに乱れ、push が壊れる。
:::

起動：

```bash
node --import tsx/esm --watch src/web.ts
```

ブラウザコンソールで接続（デフォルト `/ws`）：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

対応 Channel がないと黙って捨てられる（デフォルト `unknownEvent: 'ignore'`）。先にチャネルを通してからイベント処理を書く。

## クライアントの接続先とプロトコル

`path` が接続 URL。デフォルト `/ws`；変更時はアドレスも合わせる：

```typescript
path: '/realtime',
// ブラウザ：new WebSocket('ws://localhost:3000/realtime')
```

Socket.IO クライアントは `io('http://localhost:3000', { path: '/realtime' })`。

`transport` **必須**——握手アップグレードと送受信。入門は `new WsTransport()`；Socket.IO へはこの一行差し替え、Channel はそのまま——[トランスポート層](/ja/websocket/transport)。

`hub` **省略可**。デフォルトメモリ Hub、ルームと broadcast は**現在プロセス**のみ。レプリカ複数や Console から Web のブラウザへ push するなら Redis Hub——[マルチインスタンス Hub](/ja/websocket/hub)。

トランスポート変更と Hub 変更は独立。Socket.IO でも Socket.IO 公式 Redis adapter は**掛けない**。ルームは aomex Hub のみ。

## 握手の門番とグローバル middleware

アップグレード直前に `verify` で粗い門番。引数は通常の Web リクエスト——Cookie、ヘッダー、IP。`true` で通過；`false` または HTTP ステータス（例 `401`）で握手拒否。イベント単位の権限は Channel の mount が適切。

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` は `WebApp.mount` と同じオニオン。通常**最後**に `channels(...)`、その前にアクセスログ・限流・abuse。ここは `middleware.socket` / `middleware.mixin` のみ。HTTP 専用 middleware を入れない。

```typescript
mount: [
  // アクセスログ、限流……サイドバー「よく使うミドルウェア」参照
  channels('./src/channels'),
],
```

## 調整：未知イベントと単フレームサイズ

未登録イベント名はデフォルト `unknownEvent: 'ignore'`——黙って破棄。調整時は `'error'` で `event: 'error'` を push し、イベント名 typo をすぐ発見。本番は多くが `ignore` のまま。

```typescript
unknownEvent: 'error', // 調整時に有効化
```

`maxPayload` は単フレーム最大バイト、デフォルト 1MiB。巨大パケットはメモリを食い、下位レイヤが切断する。大 JSON や base64 スクリーンショット向けに上げる；通常チャットはデフォルトでよい。

```typescript
maxPayload: 256 * 1024, // 256KiB、やや厳しめ
```

## オンライン状況

人数変化や入站の成否を即知りたいとき `onMetric`。コールバック内の throw は warn のみ、送受信は継続。

```typescript
import { logger } from '@/services/logger.service';

export const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  mount: [channels('./src/channels')],
  onMetric: (e) => { // [!code focus:5]
    if (e.type === 'online') {
      console.log('当前在线', e.online);
    }
  },
});
```

自前で定期ポーリングするなら自機スナップショット（オンライン数・ルーム数）。**単機**データでクラスタ全体ではない：

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## HTTP ルートから push

本番で最も多い形：API が DB 書き込み → オンラインユーザーへ push → HTTP 応答は通常どおり。

接続直後、フレームワークが自動で入れるのは `client.id` ルーム（この接続だけへの push）。業務ルーム（ロビー、注文 ID）は Channel で `join` しないと `room('lobby').send` は届かない。

```typescript
// src/routers/order.ts
import { Router } from '@aomex/web';
import { ws } from '@/ws';

export const router = new Router();

router.post('/orders', { // [!code focus:8]
  action: async (ctx) => {
    const order = await createOrder(/* ... */);
    await ws.room(`order:${order.id}`).send('order.updated', order); // [!code highlight]
    ctx.send(order);
  },
});
```

いくつかの送り方：

```typescript
// 全オンライン接続
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// 特定 client.id（P2P）
await ws.room(clientId).send('dm', { text: 'hi' });

// 全員、一人を除く
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` は接続オブジェクト（`id` があれば可）または id 文字列。ルーム名は空文字不可、`\0` 不可——即 throw。

::: tip
デフォルトメモリ Hub は**プロセスを跨げない**。Console で `import { ws }` して `send` し、Console と Web が別 Node プロセスならブラウザに届かない——両方で同一 Redis Hub、 [マルチインスタンス Hub](/ja/websocket/hub)。
:::

## Web・Console との対照

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| マッチ | メソッド + パス | イベント名 | コマンド名 |
| 入参検証 | query / body / params | `payload()` | `options()` |
| 出口宣言 | `response()` | `emit()` | — |
| プロセスの居方 | listen で常駐 | 同一 Server に attach | `run` して終了 |

DB・メールは [services](/ja/core/service)；リアルタイム入出力は Channel；「書き込み成功後に push」はルートまたは Console で `ws.room` を呼ぶ。

## 次のステップ

- [イベントルート Channel](/ja/websocket/channel) — まず `pong` を返すイベント
- 入站 [payload](/ja/websocket/payload) / 出站 [emit](/ja/websocket/emit)
- [トランスポート層](/ja/websocket/transport) — Socket.IO にするか
- [マルチインスタンス Hub](/ja/websocket/hub) — レプリカや Console 跨