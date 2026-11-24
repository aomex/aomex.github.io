---
outline: deep
---

# 送信 emit

HTTP では `response()` で「この API が何を返すか」を宣言します。WebSocket では対応するのが `emit()` です：**このイベント処理のあいだ、`send` してよいイベント名とペイロードの形**を宣言します。

実行時にはほぼ何もしません（でたらめなオブジェクトを止めるわけではありません）。本当の利点は二つです：

1. TypeScript が `ctx.send` / `ctx.room().send` / `ctx.all.send` を狭めます——イベント名の打ち間違いやフィールド欠落はエディタが赤くします。
2. [AsyncAPI](/ja/asyncapi/) 生成時、送信 message はここから来ます。

チャット受信の横に送信契約を掛けます：部屋メッセージと送信確認。ペイロードが不要なら `data` を省略；`description` はドキュメント専用で実行には影響しません。

```typescript
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:24]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({ // [!code highlight]
      event: 'chat.message',
      description: '房间内聊天消息',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
    }),
    emit({ event: 'chat.ack', description: '发送确认' }),
  ],
  action: async (ctx) => {
    await ctx.room(ctx.payload.roomId).send(
      'chat.message',
      { from: ctx.client.id, text: ctx.payload.text },
      { except: ctx.client },
    );
    await ctx.send('chat.ack');
  },
});
```

`emit()` はいくつでも掛けられ、契約は一枚の表にマージされます。

::: warning
`emit()` は実行時に、`send` に渡したオブジェクトが正しいかを**検査しません**。型は TS 任せ；ドキュメントはジェネレータがフックを読みます。`emit` を掛け忘れると、`send` はまた「好きなイベント名を渡せる」状態に戻り、AsyncAPI にもその送信メッセージが出ません。
:::

ルートでの `await ws.room(...).send('order.updated', order)` は、ある Channel の `emit` 型を**自動では被せません**——呼び出し面が別です。送信体とドキュメントを揃えたいなら、同じ schema（または同形の手書きオブジェクト）で組み立ててください。

## 次のステップ

- [受信 payload](/ja/websocket/payload)
- [AsyncAPI を生成する](/ja/asyncapi/) —— payload / emit をドキュメントに掃き出す
- [イベントルーティング](/ja/websocket/channel)
