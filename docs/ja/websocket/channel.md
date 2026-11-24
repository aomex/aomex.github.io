---
outline: deep
---

# イベントルーティング Channel

Web は「パス」で API を分け、WebSocket は「イベント名」でメッセージを分けます。`src/channels` に業務ごとにファイルを切り、各ファイルで `Channel` を export し、`channel.on('イベント名', { ... })` でハンドラを登録、最後にアプリ入口で `channels('./src/channels')` を一度に掛けます——`routers('./src/routers')` と同じ習慣です。

混同しやすい語を先に：**Channel は部屋ではありません**。Channel はコードをファイルにまとめる単位です。「ロビー / 注文番号」のような部屋は、後述の `join` / `room(...).send` で作ります。一つの Channel ファイルで複数イベントを扱い、複数の部屋に出入りしても構いません。

## クライアントの送り方、サーバーの受け方

標準 WebSocket（`WsTransport`）では 1 フレームが JSON です：

```json
{ "event": "chat.send", "data": { "roomId": "lobby", "text": "hi" } }
```

`event` は `channel.on` に書いた文字列と一字一句一致している必要があります。`data` がペイロードで、次のページで `payload()` により検証します。Socket.IO 転送を選んだ場合、ブラウザ側は `socket.emit('chat.send', { ... })` になり、イベント名はやはり `channel.on` に対応します。

## まず pong を返せる Channel を書く

`ping` から始め、「部屋に入る」「チャットを送る」を足します——保存して再接続すれば試せます：

```typescript
// src/channels/chat.channel.ts
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('ping', {
  action: async (ctx) => {
    await ctx.send('pong', { at: Date.now() });
  },
});

channel.on('room.join', { // [!code focus:7]
  mount: [payload({ roomId: rule.string() })],
  action: async (ctx) => {
    await ctx.client.join(ctx.payload.roomId);
    await ctx.room(ctx.payload.roomId).send('room.joined', { id: ctx.client.id });
  },
});

channel.on('chat.send', {
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

アプリ入口ですでに `channels('./src/channels')` を掛けていれば、ブラウザではこう試します：

```typescript
const socket = new WebSocket('ws://localhost:3000/ws');
socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'ping', data: {} }));
  socket.send(
    JSON.stringify({ event: 'room.join', data: { roomId: 'lobby' } }),
  );
};
socket.onmessage = (ev) => {
  console.log(JSON.parse(String(ev.data)));
};
```

単体テストやディレクトリ走査を避けたいときは、インスタンスを直接渡せます：

```typescript
mount: [channels([chatChannel, orderChannel])],
```

::: warning
同じイベント名は二度登録できません——同一ファイルでも、ファイルを跨いでもダメです。読み込み時に throw し、「両方掛かったように見えて実際は片方だけ」を防ぎます。
:::

クライアントが送ったイベント名をどの Channel も引き受けないと、`next()` で外側に渡ります。既定は静かに捨てるので、入口で `unknownEvent` を `'error'` にすると結合試験が分かりやすくなります。

## action の中の ctx

ctx は「この一回の受信メッセージの作業台」だと考えてください。接続直後、フレームワークはすでにこの接続を `client.id` という名前の部屋に入れているので、外から `ws.room(あるid).send(...)` でポイントツーポイントできます。切断時は全部屋から自動で抜けます。手で掃除することはほとんどありません。

よく使う書き方：

| やりたいこと | 書き方 |
| --- | --- |
| イベント名を見る | `ctx.event` |
| 生の data（未検証）を見る | `ctx.rawPayload` |
| 検証後のデータを見る | `ctx.payload`（先に `payload()` を掛ける必要あり） |
| この接続だけに返す | `ctx.send(...)` または `ctx.client.send(...)` |
| 部屋に入る / 出る | `ctx.client.join(name)` / `leave(name)` |
| ある部屋へ送る | `ctx.room(name).send(...)`（既定は**自分も含む**） |
| すべてのオンラインへ | `ctx.all.send(...)` |
| この接続を切る | `ctx.client.close(code, reason)` |

部屋ブロードキャストは既定で自分にも届きます。チャットで自分が送った直後のメッセージを受けたくないときは `{ except: ctx.client }` を付けます：

```typescript
await ctx.room('lobby').send(
  'chat.message',
  { from: ctx.client.id, text: ctx.payload.text },
  { except: ctx.client }, // [!code highlight]
);
```

## 接続に業務データを少し載せる

`ctx.client.data` は普通のオブジェクトで、この接続に付いて回ります。ログイン成功後に `userId` を入れ、以降のイベントで読めます。既定型は `Record<string, unknown>` なので、必要ならモジュール拡張します：

```typescript
channel.on('auth.ok', {
  mount: [payload({ userId: rule.string() })],
  action: async (ctx) => {
    ctx.client.data['userId'] = ctx.payload.userId; // [!code highlight]
    await ctx.send('auth.ok', { ok: true });
  },
});
```

```typescript
declare module '@aomex/websocket' {
  namespace WebsocketContext {
    interface Props {
      userId: string;
    }
  }
}
```

## ファイル全体で共有する mount

ある Channel の全イベントで先にログインが必要なら、`new Channel({ mount })` に書きます。各 `on` にコピーするより楽です。イベント自身の `mount` には引き続き `payload()` などを掛けられ、その一条だけに効きます。

```typescript
export const channel = new Channel({
  mount: [requireLogin()], // [!code highlight]
});

channel.on('chat.send', {
  mount: [payload({ text: rule.string().max(2000) })],
  action: async (ctx) => {
    await ctx.room('lobby').send('chat.message', {
      from: ctx.client.id,
      text: ctx.payload.text,
    });
  },
});
```

デバッグ用イベントを一時的に切るときは `disabled`。本番では登録自体しません：

```typescript
channel.on('debug.dump', {
  disabled: process.env.NODE_ENV === 'production',
  action: async (ctx) => {
    await ctx.send('debug.dump', ctx.client.data);
  },
});
```

## 次のステップ

- [受信 payload](/ja/websocket/payload) —— data を自分で `as` しない
- [送信 emit](/ja/websocket/emit) —— `send` の型を狭め、AsyncAPI にも載せる
- [アプリケーション入口](/ja/websocket/) —— HTTP ルートから部屋へ送る
