---
outline: deep
---

# Scalar UI

[Scalar](https://github.com/scalar/scalar) ベースの API ドキュメントページを載せる。閲覧はモダンで、ページ内試行もできる。契約はファイル出力した openapi.json / yaml、または実行時 `generateOpenapi`。[Swagger UI](/ja/openapi/swagger-ui) / [Redoc UI](/ja/openapi/redoc-ui) と同站併存可。**uriPrefix の衝突に注意**（デフォルト `/scalar`）。

まずは [公式デモ](https://galaxy.scalar.com/) を見てから。契約の出どころ：[生成OpenAPI](/ja/openapi/)。

```bash
pnpm add @aomex/scalar-ui
```

`WebApp.mount` に `scalarUI` を載せ、/scalar（または設定した prefix）で閲覧できる。

## ファイル出力または動的 generateOpenapi

**CI でファイル出力済み**（よくある）：

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

yaml / yml パスも可。ブラウザ：/scalar。同接頭辞下に openapi.json があり、ページが取得する。

**本番ルートと同期**：

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from './app.js';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

`scalarUI` は通常の Web ミドルウェア。`openapi` はパス文字列、または Document を返す関数（非同期可）。関数のときは**同じ** `WebApp`（`app`）を `generateOpenapi` に渡し、security / envelope を実環境と揃える。サイト全体で [envelope](/ja/web/envelope) を有効にしていると、ドキュメントページは自動で `skipEnvelope` されラップされない。

## uriPrefix、enable、headTags

| オプション / 書き方 | いつ使う |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | CI の `aomex openapi` 出力後にホスト |
| `openapi: () => generateOpenapi(...)` | 契約ファイルをコミットしない；同じ `app` |
| `uriPrefix` | デフォルト `/scalar`；**ランダム文字列**付きパスに変えるとスキャン後の悪用リスクを下げやすい |
| `enable` | 本番をパブリックから閉じる、または token / IP 許可リスト |
| `headTags` | ドキュメントページの `<head>` に favicon、追加 meta / link |

`/scalar`、`/swagger` のようなデフォルトはスキャンされやすい。ランダム文字列（例 `/scalar-7c3e9a1f02b48d6e`）は当たりコストを上げるだけで、**`enable` / 社内分離の代わりにならない**——[Swagger UI](/ja/openapi/swagger-ui) と同じ考え方。

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

サイトアイコンを挿入：

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

載せる位置：業務 API 接頭辞と衝突させない。swaggerUI / redocUI と同時運用時は 3 つの `uriPrefix` を分ける（ランダム文字列推奨）。

::: warning
パブリックにドキュメント UI を晒すと API の地図（試行能力含む）を一緒に渡す。ランダム接頭辞と `enable` / ネットワーク分離をセットで使う。
:::

動的 `openapi` で本番と同じ `app` を渡し忘れると、ページ上の認可・ラップ形状と実連携がずれる。静的ファイルモードではルート変更後 [生成OpenAPI](/ja/openapi/) で再出力。

Swagger / Redoc との比較、併存、シナリオ選定は [ドキュメント UI の選び方](/ja/openapi/choose-ui)。

## 関連

- [ドキュメント UI の選び方](/ja/openapi/choose-ui)
- [Swagger UI](/ja/openapi/swagger-ui) · [Redoc UI](/ja/openapi/redoc-ui)
- [生成OpenAPI](/ja/openapi/)