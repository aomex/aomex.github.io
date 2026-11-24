---
outline: deep
---

# AsyncAPI UI

リアルタイムチャネルにも「人が読める」ドキュメントページを掛けます。公式の `@asyncapi/react-component` ベースです。前提は手元に AsyncAPI があること：CI が落とした `asyncapi.json` でも、実行時にその場で生成しても構いません。

まず UI を触りたいとき：[公式デモ](https://asyncapi.github.io/asyncapi-react/)。契約の作り方：[AsyncAPI を生成する](/ja/asyncapi/)。

これは **WebApp** に掛ける普通のミドルウェアです（WebsocketApp には掛けません）——ドキュメントページ自体は HTTP です。

```bash
pnpm add @aomex/asyncapi-ui
```

## 出力済みファイルを読む（いちばん多い）

CI がすでに `npx aomex asyncapi` でファイルを出していれば、掛けるだけです。ブラウザで `/asyncapi`（または `/asyncapi/index.html`）を開きます。同じ接頭辞の下でだいたい `asyncapi.json` 本体も取れます：

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';

mount: [
  asyncapiUI({ asyncapi: './asyncapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

`asyncapi` は `.yaml` / `.yml` パスでも構いません。

## リクエストごとにその場で生成する

契約ファイルをリポジトリに入れたくないときは、関数を渡し、中で `generateAsyncapi` を呼びます。`uriPrefix` の既定は `/asyncapi`。パスを変えるときだけ書きます：

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

mount: [ // [!code focus:14]
  asyncapiUI({
    uriPrefix: '/asyncapi',
    asyncapi: async () => { // [!code highlight]
      return generateAsyncapi({
        channels: './src/channels',
        docs: {
          asyncapi: '3.1.0',
          info: { title: 'Realtime', version: '1.0.0' },
        },
      });
    },
  }),
  routers('./src/routers'),
],
```

## 本番ではむき出しにしない

既定パス `/asyncapi` は推測されやすいです。スキャフォールド流はランダム文字列を足し、公開網では `enable` で IP / ログインの門番を付けます。ランダム文字列は**認証ではありません**。スキャンされるコストを上げるだけです。Swagger / Redoc と同時に掛けても構いません。接頭辞が衝突しなければよいです。ドキュメントページの `<head>` に favicon を足すときは `headTags` を使います。

```typescript
asyncapiUI({
  asyncapi: './asyncapi.json',
  uriPrefix: '/asyncapi-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => {
    return ctx?.request.ip === '127.0.0.1';
  },
});
```

## 次のステップ

- [AsyncAPI を生成する](/ja/asyncapi/)
- [WebSocket アプリケーション入口](/ja/websocket/)
- HTTP 側ドキュメント UI の対照：[ドキュメント UI の選び方](/ja/openapi/choose-ui)
