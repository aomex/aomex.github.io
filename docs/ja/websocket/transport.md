---
outline: deep
---

# トランスポート層

トランスポートが答えるのは一つ：**クライアントがどのプロトコルで接続し、フレームがどう見えるか**。ルームやマシン間ブロードキャストは [Hub](/ja/websocket/hub) の管轄。Channel の業務ができたあと、差し替えは通常 `new WebsocketApp({ transport })` の一行。

今は二つの実装。入門は標準 WebSocket でよい。

| 重視する点 | 選択 |
| --- | --- |
| ブラウザ原生 `WebSocket`、ゲートウェイは upgrade 転送のみ、プロトコルはシンプルに | `@aomex/websocket-ws-transport` |
| フロントが Socket.IO、自動再接続 / ロングポーリング降格が必要 | `@aomex/websocket-socket-io-transport` |

## 標準 WebSocket（まず通す）

```bash
pnpm add @aomex/websocket-ws-transport
```

`path`、単フレームサイズ、`verify` は `WebsocketApp` 側。**`WsTransport` に二重設定しない**。コンストラクタ引数は主に底層 `ws` への透過。ハートビートは `heartbeatInterval`（デフォルト 30 秒；`0` でオフ、単体テスト向け）：

```typescript
import { WebsocketApp, channels } from '@aomex/websocket';
import { WsTransport } from '@aomex/websocket-ws-transport';
import { logger } from '@/services/logger.service';

const ws = new WebsocketApp({
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  path: '/ws',
  transport: new WsTransport({ // [!code focus:4]
    perMessageDeflate: false,
    heartbeatInterval: 30_000,
  }),
  mount: [channels('./src/channels')],
});
```

ブラウザは原生 `WebSocket`、フレームは JSON：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onmessage = (ev) => {
  const frame = JSON.parse(String(ev.data));
  // frame.event / frame.data
  console.log(frame.event, frame.data);
};

socket.send(JSON.stringify({ event: 'ping', data: {} }));
```

## Socket.IO へ差し替え

フロントが既に `socket.io-client`、または劣悪なネットワークで降格が要るとき。**ルームは引き続き aomex の Hub**。`@socket.io/redis-adapter` は**掛けない**——二重ブロードキャストで地獄。

```bash
pnpm add @aomex/websocket-socket-io-transport
```

`path`、最大バッファはアプリが注入。namespace、ack、`volatile` は意図的に非公開——送信は Channel / `ws.room` の `send` に統一。CORS や ping 間隔はコンストラクタで：

```typescript
import { SocketIoTransport } from '@aomex/websocket-socket-io-transport';

transport: new SocketIoTransport({ // [!code focus:3]
  cors: { origin: '*' },
  pingInterval: 25_000,
}),
```

ブラウザは Socket.IO クライアント必須（原生 `WebSocket` では接続不可）：

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { path: '/ws' });
socket.emit('echo', { text: 'hi' });
socket.on('echo', (data) => {
  console.log(data);
});
```

## シャットダウン時

`ws.attach(app, server)` 時に WebApp にシャットダウンフック登録：シグナルで接続を切り、トランスポートを片付けるが、渡した `http.Server` 自体は**閉じない**（Server は WebApp が閉じる）。通常トランスポート用に `process.on('SIGTERM')` を重ね書きしない。

## 次のステップ

- [マルチインスタンス Hub](/ja/websocket/hub) — レプリカや Console からも push
- [アプリ入口](/ja/websocket/)
- [イベントルート](/ja/websocket/channel)