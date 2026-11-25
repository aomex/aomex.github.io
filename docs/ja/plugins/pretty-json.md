---
outline: deep
---

# JSON の整形表示

開発時にブラウザで**インデント付き JSON**を見る。一行の長い文字列でフィールドを探さなくて済む。本番はデフォルトオフ——応答サイズが目に見えて増える（モバイル特に）。公開 API で query に頼って body を膨らませるべきではない。

```bash
pnpm add @aomex/pretty-json
```

## 開発環境で全サイト

`prettyJson()` は `await next()` **の後**で JSON 応答をインデントテキストに変える。`WebApp.mount` に載せる。ローカルは環境でオン、本番は `enable: false`。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

通常の WebMiddleware。ctx に追加フィールドなし。Content-Type が JSON のまま body が `JSON.stringify(..., null, spaces)` の読みやすいテキストになる。オブジェクトモードの読み取りストリームはストリーミング stringify。4 スペースが好みなら `spaces: 4`（デフォルト `2`）。

## 本番は必要時だけ：`?pretty`

本番に全サイト整形は入れない。`enable` を切り、`query` だけ：`/internal/debug/state?pretty` のときだけインデント。公開ルートで query による肥大化に頼らない。

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| 環境 | 目安 |
| --- | --- |
| ローカル | `enable: true`、または `?pretty` のみ |
| 本番 | `enable: false`；公開ルートで query による肥大化を避ける |

大きな一覧を全部 pretty するとコンパクト JSON の数倍になり、Postman も重くなる。[Compress](/ja/plugins/compress) と重ねても少し圧せるが、根本は pretty で body が長くなっていること。

## 次に

- JSON の業務形：[レスポンス制約](/ja/web/response)
- サイズ圧縮：[Compress](/ja/plugins/compress)
- 開発時のドキュメント UI：[Swagger UI](/ja/openapi/swagger-ui)