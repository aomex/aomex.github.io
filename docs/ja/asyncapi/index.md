---
outline: deep
---

# AsyncAPI の生成

OpenAPI は HTTP インターフェースを記述します。リアルタイムチャネルには **AsyncAPI** が対応します。Channel 上で `payload()` / `emit()` により入出站の形を宣言済みなら、ジェネレータがそれをスキャンして AsyncAPI 3.x ドキュメントにし、フロント・連携先、または [AsyncAPI UI](/ja/asyncapi/asyncapi-ui) で閲覧できます。

`payload` / `emit` を載せていないイベントは、ドキュメント上の該当段落が空になります。サービスは動きますが契約が不完全で、相手は推測しかできません。

```bash
pnpm add @aomex/asyncapi-generator
```

## まず Channel で契約を揃える

入站は `payload()`、出站は `emit()`。ランタイム検証と型の絞り込みはドキュメントと同じソース — 一箇所変えれば両方変わります。

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

## スクリプトから直接生成

`generateAsyncapi` は Channel ディレクトリ（またはインスタンス配列）を受け取ります。`docs.asyncapi` のバージョンは自分で書く（`3.0.0` または `3.1.0`）— ジェネレータは推測しません。

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

`servers` などジェネレータが触れないフィールドは `fix` で Document を編集：

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

## Console でファイル出力（CI 向け）

OpenAPI 落盘と同型：`ConsoleApp` に載せ、ターミナルで 1 コマンド。`commandName` の既定は `asyncapi`；`saveToFile` の既定は `asyncapi.json`。`.yaml` / `.yml` も可（拡張子で形式を選択）。

```typescript
import { asyncapi } from '@aomex/asyncapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { logger } from '@/services/logger.service';

const app = new ConsoleApp({
  services,
  logger,
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

実行中はターミナルで数ステップ回ります（ファイル検索 → 解析 → 保存 → 検証）。スクリプトからは上記 `generateAsyncapi` を優先 — spinner なし、アサートしやすいです。

## 次のステップ

- [AsyncAPI UI](/ja/asyncapi/asyncapi-ui) — ブラウザでこのドキュメントを閲覧
- [出站 emit](/ja/websocket/emit) / [入站 payload](/ja/websocket/payload)
- [イベントルーティング](/ja/websocket/channel)