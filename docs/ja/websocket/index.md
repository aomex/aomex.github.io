---
outline: deep
---

# WebSocket アプリケーション入口

チャット、注文ステータス、共同編集のカーソル——サーバーからブラウザへ能動的に送る必要がある場面向けです。Web と同じ要領で `WebsocketApp` を作り、**同じ** HTTP ポートにぶら下げます。クライアントは接続後「イベント名」で業務に入ります。注文を DB に書けたら、通常の HTTP ルートから同じ `ws` を呼び、まだオンラインの相手へメッセージを送れます。

先に一つだけ押さえてください：メッセージは**ベストエフォート**です。`await ws.room(...).send(...)` が終わっても、フレームワークが外へ書いた（または Redis に渡した）だけで、相手が必ず受け取った保証はなく、自動再送もオフライン受信箱もありません。重要なデータはいつもどおり永続化し、クライアントは再接続後に HTTP で欠けた状態を補います。

## 依存を入れ、最初のインスタンスを書く

すでに動く [Web アプリケーション](/ja/web/) がある前提です。リアルタイム用パッケージを追加します：

```bash
pnpm add @aomex/websocket @aomex/websocket-ws-transport
```

`WebsocketApp` は単独ファイルに置き、`export` してください。HTTP 入口・ルート・Console コマンドはすべてこの一本を import します——ファイルごとに `new` すると、送信が接続と噛み合いません。

```typescript
// src/ws.ts
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { services } from './services/index.js';

export const ws = new WebsocketApp({ // [!code focus:8]
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport(),
  mount: [channels('./src/channels')], // [!code highlight]
});
```

`logger`、`language`、`transport` は必須です。欠けるとコンパイラが止めます。

- `logger`：Web / Console と同じ `services.logger` を渡します。転送層の初期化失敗や部屋へのファンアウトエラーはここに出ます。
- `language`：この接続上のフレームワーク文言（ハンドシェイク失敗、不正フレームの切断理由、レート制限 / 検証失敗の返信）を決めます。上の例は `fixed`——管理画面・社内・単一言語ならこれが一番簡単です。
- `mount`：まず `channels('./src/channels')` を掛けます。Web で `routers('./src/routers')` を掛けるのと同種です。Channel の書き方は [イベントルーティング](/ja/websocket/channel)。

公開マルチクライアントでハンドシェイクのリクエストヘッダから言語を協議するなら、`dynamic` にし、`fallback` を付けます：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

`header` の既定は `accept-language`（`q` で並べ替え）。アプリ独自ヘッダなら `x-language` でも構いません。言語コードは `zh-CN`、`en-US`（ハイフン）。

::: tip
**HTTP ルート**から `ws.room().send()` を呼ぶとき、言語は**その HTTP リクエスト**のもので、長接続がハンドシェイク時に決めた言語ではありません。
:::

## HTTP ポートにぶら下げる

WebSocket は自分で別ポートを listen しません——Web 側の `http.Server` でプロトコルアップグレードします。そのためプロセス入口では `app.listen(3000)` 一発ではなく、先に `app.http({})` で server を取り → `ws.attach` → それから `listen` します。

```typescript
// src/web.ts —— 真正启动进程的入口
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';
import { ws } from './ws.js';

const app = new WebApp({
  services,
  logger: services.logger,
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

`attach` は `listen` の**前**に必須です。同じ `ws` は一度しか attach できず、二度目は即エラーになります。プロセスが停止シグナルを受けると、フレームワークは HTTP を閉じつつ WebSocket 接続をドレインするので、二系統の後始末を自分で書く必要はありません。

::: warning
`src/ws.ts` のモジュールトップで `ws.attach(...)` を書かないでください。Console コマンドも `ws` を import するので、import のたびに attach が走り、プロセス同士で送信が壊れます。
:::

起動：

```bash
node --import tsx/esm --watch src/web.ts
```

ブラウザのコンソールでまず疎通確認（パス既定は `/ws`）：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
};
socket.onmessage = (ev) => {
  console.log(ev.data);
};
```

対応する Channel がまだ無いと、このメッセージは黙って捨てられることがあります（既定 `unknownEvent: 'ignore'`）。先にチャネルを通してからイベント処理を書きましょう。

## クライアントはどこへ、どのプロトコルで

`path` がブラウザの接続先です。既定は `/ws`；変えたらアドレスも合わせて変えます：

```typescript
path: '/realtime',
// ブラウザ：new WebSocket('ws://localhost:3000/realtime')
```

Socket.IO クライアントなら `io('http://localhost:3000', { path: '/realtime' })` です。

`transport` は**必須**で、ハンドシェイクのアップグレードと各フレームの送受信を担当します。ローカル入門は `new WsTransport()` で十分；あとで Socket.IO に換えるならこの一行だけで、Channel 業務はそのまま——詳しくは [転送層](/ja/websocket/transport)。

`hub` は**省略可**。既定はメモリ Hub で、部屋とブロードキャストは**現在のプロセス**内だけ有効です。単機開発には十分です。複数レプリカや、Console プロセスから Web 上の人へ送るときは Redis Hub に換えてください——[マルチマシン Hub](/ja/websocket/hub)。

二者は独立です：転送を換えても Hub は換えなくてよく、マルチマシン化は Hub だけ換えます。Socket.IO を使っても、Socket.IO 付属の Redis adapter は**載せない**でください。部屋は aomex の Hub だけを見ます。

## ハンドシェイクで粗く止め、グローバルミドルウェアを掛ける

接続がまさにアップグレードしようとしているとき、`verify` で粗い門番ができます。引数は普通の Web リクエストオブジェクトで、Cookie・ヘッダ・IP が読めます。`true` で通し；`false` または HTTP ステータス（例：`401`）で拒否します。イベント単位の権限は Channel の mount の方が向いています。

```typescript
export const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  transport: new WsTransport(),
  verify: (request) => { // [!code focus:3]
    return request.cookies['sid'] ? true : 401;
  },
  mount: [channels('./src/channels')],
});
```

`mount` は `WebApp.mount` と同じオニオンキューです。通常は**最後**に `channels(...)` を掛け、手前にアクセスログ・レート制限・濫用チェックを置けます。ここには `middleware.socket` / `middleware.mixin` だけ。HTTP 専用ミドルウェアは入れないでください。

```typescript
mount: [
  // 访问日志、限速……见侧栏「常用中间件」
  channels('./src/channels'),
],
```

## 結合試験：未知イベントと単フレームサイズ

クライアントが未登録のイベント名を送ってきたとき、既定は `unknownEvent: 'ignore'`——黙って捨てます。結合試験中は `'error'` にすると、フレームワークが `event: 'error'` のフレームを返し、フロントがイベント名の打ち間違いにすぐ気づけます。本番では多くが `ignore` のままです。

```typescript
unknownEvent: 'error', // 联调时打开
```

`maxPayload` は単フレームの最大バイト数で、既定は 1MiB。大きすぎるパケットはメモリを食い、下位層が即切断します。大きな JSON やスクリーンショットの base64 などで必要になってから上げてください。チャットのテキストなら既定で十分です。

```typescript
maxPayload: 256 * 1024, // 256KiB，收紧一点
```

## オンライン状況を見る

人数変化や受信の成否をすぐ知りたいときは `onMetric` を掛けます。何かあるとコールバックします。コールバック内の throw は warn になるだけで、送受信には影響しません。

```typescript
export const ws = new WebsocketApp({
  logger: services.logger,
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

自分で定期的に本機スナップショット（オンライン数、部屋数）を取ることもできます。これは**単機**のデータで、クラスタ全体の集計ではありません：

```typescript
setInterval(async () => {
  const s = await ws.stats();
  console.log(s.online, s.rooms);
}, 10_000);
```

## HTTP ルートからメッセージを送る

これが本番でいちばん多い使い方です：API で DB 書き込み → まだオンラインの人へ送る → HTTP はいつもどおり返す。

接続が立った直後、フレームワークは自動で `client.id` という名前の部屋にだけ入れます（「この接続だけへ送る」用）。業務の部屋（ロビー、注文番号）は Channel で自分で `join` しないと、`room('lobby').send` の受け手がいません。

```typescript
// src/routers/order.ts
import { Router } from '@aomex/web';
import { ws } from '../ws.js';

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
// 所有在线连接
await ws.all.send('system.notice', { text: '维护 5 分钟' });

// 某个 client.id（点对点）
await ws.room(clientId).send('dm', { text: 'hi' });

// 全员，但排除某个人
await ws.all.send('notice', { text: '...' }, { except: clientId });
```

`except` には接続オブジェクト（`id` があればよい）も、id 文字列そのものも渡せます。部屋名は空文字や `\0` を含むと即エラーになります。

::: tip
既定のメモリ Hub は**プロセスを越えられません**。Console で `import { ws }` して `send` しても、Console と Web が同じ Node プロセスでなければブラウザに届きません——双方を同じ Redis Hub に揃えてください。[マルチマシン Hub](/ja/websocket/hub)。
:::

## Web・Console と並べて見る

すでに分かる三つの入口を並べると混ざりにくいです：

| | Web | WebSocket | Console |
| --- | --- | --- | --- |
| マッチの仕方 | メソッド + パス | イベント名 | コマンド名 |
| 入力の検証 | query / body / params | `payload()` | `options()` |
| 出口の宣言 | `response()` | `emit()` | — |
| プロセスの生き方 | listen し続ける | 同じ Server に attach | `run` で終わる |

DB 照会やメール送信は引き続き [services](/ja/core/service)；リアルタイムの出入りは Channel；「書き込み成功後にもう一度送る」はルートや Console コマンドから `ws.room` を呼びます。

## 次のステップ

- [イベントルーティング Channel](/ja/websocket/channel) —— まず `pong` を返すイベントを書く
- [受信 payload](/ja/websocket/payload) / [送信 emit](/ja/websocket/emit)
- [転送層](/ja/websocket/transport) —— Socket.IO にするか
- [マルチマシン Hub](/ja/websocket/hub) —— 複数レプリカや Console のクロスプロセス送信
