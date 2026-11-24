---
outline: deep
---

# 受信 payload

クライアントがイベントに添えて来る `data` は、既定では信用できません。イベントの mount に `payload()` を掛け、すでに慣れている [バリデータ](/ja/validators/) でフィールドを宣言します。通ったあと業務では `ctx.payload` をそのまま使え、型も狭まっています。通らなければフレームワークは**この接続**へ `{ event: 'error', data: { message } }` を送り、`action` には**入りません**——HTTP で body 検証失敗時に 400 を返してルートに入らないのと同じ発想です。

まずチャットの受信を書きます：

```typescript
import { Channel, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:16]
  mount: [
    payload({ // [!code highlight]
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    // 这里 ctx.payload.roomId / text 已经是 string
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
  },
});
```

クライアントは引き続き約束どおり送ります：

```typescript
socket.send(
  JSON.stringify({
    event: 'chat.send',
    data: { roomId: 'lobby', text: 'hello' },
  }),
);
```

`text` が長すぎる、または `roomId` が欠けると、`onmessage` で `event === 'error'` を受け取り、業務 action は走りません。action の中で再び `if (typeof raw.text !== 'string')` を書かないでください——検証・エラー文言・後の AsyncAPI と揃わなくなります。

::: tip
`payload()` を掛けていないとき、`ctx.payload` の型は `unknown` で、実行時に値が無いこともあります。一時デバッグでは `ctx.rawPayload`（フレーム内の生 `data`）を読めますが、正式なインターフェースでは `payload()` を掛けてください。
:::

## 複数イベントでフィールドを共有する

たとえば各イベントが任意の `token` を持ちうるなら、Channel のコンストラクタに掛け、個別イベントで自分の `payload()` を足して業務フィールドを補えます。型上、後から掛けた同名フィールドが前を上書きします。

```typescript
export const channel = new Channel({
  mount: [
    payload({
      token: rule.string().optional(),
    }),
  ],
});

channel.on('chat.send', { // [!code focus:12]
  mount: [
    payload({
      text: rule.string().max(2000),
    }),
  ],
  action: async (ctx) => {
    ctx.payload.token; // string | undefined
    ctx.payload.text; // string
  },
});
```

入力の形は `body()` / `query()` と同じです：フィールド表、`rule.object()`、スカラー、`schema(...)` いずれも可。[AsyncAPI](/ja/asyncapi/) 生成時、ここでの宣言が受信 message に入ります。掛け忘れるとドキュメント側は空なのに、実行時は `rawPayload` でごまかせてしまい——結合試験で契約欠けに気づきにくいです。

::: tip
レート制限や認証失敗などの業務エラーも、慣習として `event: 'error'`（または [emit](/ja/websocket/emit) で宣言した専用イベント）を返します。フロントが少数の出口だけ聞けばよく、頭が楽になります。
:::

## 次のステップ

- [送信 emit](/ja/websocket/emit)
- [イベントルーティング](/ja/websocket/channel)
- [バリデータ入門](/ja/validators/)
