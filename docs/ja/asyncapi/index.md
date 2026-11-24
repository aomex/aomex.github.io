---
outline: deep
---

# AsyncAPI を生成する

OpenAPI が記述するのは HTTP インターフェースです。リアルタイムチャネルに対応するのは **AsyncAPI** です。Channel 上ですでに `payload()` / `emit()` で出入りの形を宣言している——ジェネレータがそれらを掃き出して AsyncAPI 3.x ドキュメントにし、フロントや連携先、あるいは [AsyncAPI UI](/ja/asyncapi/asyncapi-ui) で閲覧できます。

payload / emit を掛けていないイベントは、ドキュメント側の対応段落が空になります。サービスは動きますが契約が不完全で、結合試験では相手が推測するしかありません。

```bash
pnpm add @aomex/asyncapi-generator
```

## まず Channel 上で契約を揃える

受信は `payload()`、送信は `emit()` です。実行時の検証と型の絞り込みとドキュメントは同じソース——一か所直せば両方が変わります。

```typescript
// src/channels/chat.channel.ts
import { Channel, emit, payload } from '@aomex/websocket';
import { rule } from '@aomex/common';

export const channel = new Channel();

channel.on('chat.send', { // [!code focus:18]
  mount: [
    payload({
      roomId: rule.string(),
      text: rule.string().max(2000),
    }),
    emit({
      event: 'chat.message',
      description: '房间内聊天消息',
      data: {
        from: rule.string(),
        text: rule.string(),
      },
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

## スクリプトから直接生成する

`generateAsyncapi` は Channel ディレクトリ（またはインスタンス配列）を受け取ります。`docs.asyncapi` のバージョンは自分で書きます（`3.0.0` または `3.1.0`）。ジェネレータは推測しません：

```typescript
import { writeFile } from 'node:fs/promises';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

const document = await generateAsyncapi({ // [!code focus:8]
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
});

await writeFile('asyncapi.json', JSON.stringify(document, null, 2));
```

`servers` などジェネレータが触れないフィールドを足すときは、`fix` で Document を直します：

```typescript
await generateAsyncapi({
  channels: './src/channels',
  docs: {
    asyncapi: '3.1.0',
    info: { title: 'Realtime', version: '1.0.0' },
  },
  fix: (data) => { // [!code focus:9]
    data.servers = {
      production: {
        host: 'api.example.com',
        pathname: '/ws',
        protocol: 'wss',
      },
    };
  },
});
```

## Console でディスクに落とす（CI 向け）

OpenAPI のファイル出力と同じ型です：`ConsoleApp` に掛け、端末で一本コマンドを走らせます。`commandName` の既定は `asyncapi`；`saveToFile` の既定は `asyncapi.json` で、`.yaml` / `.yml` にもできます（拡張子で形式を選びます）。

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';

const app = new ConsoleApp({
  services,
  logger: services.logger,
  language: 'zh-CN',
  mount: [ // [!code focus:12]
    asyncapi({
      commandName: 'asyncapi',
      channels: './src/channels',
      docs: {
        asyncapi: '3.1.0',
        info: { title: 'Realtime', version: '1.0.0' },
      },
      saveToFile: 'asyncapi.json',
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex asyncapi
```

実行中、端末は数ステップ回転します（ファイル探索 → 解析 → 保存 → 検証）。スクリプトから呼ぶなら上の `generateAsyncapi` を優先してください。spinner がなく、アサーションしやすいです。

## 次のステップ

- [AsyncAPI UI](/ja/asyncapi/asyncapi-ui) —— ブラウザでこのドキュメントを眺める
- [送信 emit](/ja/websocket/emit) / [受信 payload](/ja/websocket/payload)
- [イベントルーティング](/ja/websocket/channel)
