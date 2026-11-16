---
outline: deep
---

# 整形 JSON

開発時にブラウザで**インデント付き JSON** を見て、1 行の長い文字列からフィールドを探す手間を減らす。本番はデフォルトオフ。さもないとレスポンスが明らかに肥大化（モバイルは特に損）。公開 API を query で body を膨らませるべきではない。

```bash
pnpm add @aomex/pretty-json
```

## 開発環境でサイト全体マウント

`prettyJson()` は `await next()` の**後**で JSON レスポンスをインデント付きテキストにする。`WebApp.mount` に載せる。本番は `enable: false` か `?pretty` のみ。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
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

通常の WebMiddleware。ctx に追加フィールドなし。Content-Type が JSON のとき body は JSON.stringify(..., null, spaces) の読みやすい形。オブジェクトモードの Readable はストリーム stringify。

## enable と query スイッチ

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `enable` | 本番は必ず `false`；社内デバッグツールだけ別途オン可 | `true` |
| `query` | サイト全体を整形せず `?pretty` のときだけ | — |
| `spaces` | 2 または 4 スペースの好み | `2` |

```typescript
prettyJson({ spaces: 4 });
```

### 社内のみ / オンデマンド

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| 環境 | 推奨 |
| --- | --- |
| ローカル | `enable: true` か `?pretty` のみ |
| 本番 | `enable: false`；公開ルートを query で膨らませない |

大きな一覧を全件 pretty にするとコンパクト JSON の数倍になり、Postman も重くなる。[Compress](/ja/plugins/compress) と重ねても少し押せるが、根本は pretty で body が長くなること。

## 次のステップ

- JSON の業務形：[制約付きレスポンス](/ja/web/response)
- サイズ削減：[Compress](/ja/plugins/compress)
- 開発用ドキュメント UI：[Swagger UI](/ja/plugins/swagger-ui)