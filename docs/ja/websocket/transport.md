---
outline: deep
---

# 転送層

転送層が答えるのは一件だけです：**クライアントがどのプロトコルで接続し、フレームがどんな形か**。部屋やマシンを跨いだブロードキャストは扱いません。それは [Hub](/ja/websocket/hub) の仕事です。業務 Channel を書いたあと、転送の切り替えは通常 `new WebsocketApp({ transport })` の一行だけで足ります。

いま既製実装は二系統あります。入門はまず標準 WebSocket で十分です。

| 重視すること… | 選ぶもの |
| --- | --- |
| ブラウザネイティブ `WebSocket`、ゲートウェイが upgrade を転送するだけ、プロトコルは単純なほどよい | `@aomex/websocket-ws-transport` |
| フロントがすでに Socket.IO、または自動再接続 / ロングポーリングのフォールバックが要る | `@aomex/websocket-socket-io-transport` |

## 標準 WebSocket（まずこちらで通す）

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`、単フレームサイズ、`verify` はすべて `WebsocketApp` で配ります。`WsTransport` に二度書かないでください。コンストラクタ引数は主に下位の `ws` ライブラリへ透かすオプションです。ハートビートを触るときだけ `heartbeatInterval` を書きます（既定 30 秒；`0` で心拍オフ、単体テストでよく使います）：

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';

const ws = new WebsocketApp({
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport({ // [!code focus:4]
    perMessageDeflate: false,
    heartbeatInterval: 30_000,
  }),
  mount: [channels('./src/channels')],
});
```

ブラウザ側はネイティブ `WebSocket`、フレームは JSON です：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## Socket.IO に換える

フロントがすでに `socket.io-client` に依存している、または劣悪なネットワーク向けのフォールバックが必要なときだけ換えます。**部屋は引き続き aomex の Hub** です。`@socket.io/redis-adapter` を載せないでください。二系統のブロードキャストになり、切り分けが苦しくなります。

```bash
pnpm add @aomex/websocket-socket-io-transport
```

同じく：`path` と最大バッファはアプリが注入します。フレームワークは意図的に namespace、ack、`volatile` を露出していません——送信は Channel / `ws.room` の `send` に統一し、二系統の考え方を避けます。CORS や ping 間隔を変えるときはコンストラクタに書きます：

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

ブラウザ側は Socket.IO クライアント必須です（ネイティブ `WebSocket` では繋がりません）：

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## シャットダウン時に起きること

`ws.attach(app, server)` の時点で WebApp にシャットダウンフックが登録済みです。シグナルを受けると接続を蹴り、転送を片付けますが、渡した `http.Server` までは閉じません（Server は WebApp 自身が閉じます）。転送層のために改めて `process.on('SIGTERM')` を書く必要は通常ありません。

## 次のステップ

- [マルチマシン Hub](/ja/websocket/hub) —— 複数レプリカや Console からも送りたいとき
- [アプリケーション入口](/ja/websocket/)
- [イベントルーティング](/ja/websocket/channel)
