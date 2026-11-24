---
outline: deep
---

# Swagger UI

ローカルや社内で、**開けばすぐ試行できる** API ドキュメントを載せる。前提は OpenAPI Document（ファイル出力した openapi.json、または実行時の `generateOpenapi`）。長文閲覧は [Redoc UI](/ja/openapi/redoc-ui)、モダンな試行 UI は [Scalar UI](/ja/openapi/scalar-ui)。複数 UI の併存可。**接頭辞の衝突に注意**。

まずは [公式デモ](https://petstore.swagger.io/) を見てから。契約の出どころ：[生成OpenAPI](/ja/openapi/)。

```bash
pnpm add @aomex/swagger-ui
```

`WebApp.mount` に swaggerUI を載せると、開発メンバーが /swagger（または設定した prefix）を開いて閲覧・Try it out できる。

## ファイル出力または動的 generateOpenapi

**CI でファイル出力済み**（よくある）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

ブラウザ：/swagger（または /swagger/index.html）。仕様 JSON は通常、同じ接頭辞下の openapi.json。

**本番ルートと同期**（静的ファイルを手メンテしない）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
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

swaggerUI は mount 上の通常の Web ミドルウェアで、業務ルートに対する型推論は変えない。`openapi` は**パス文字列**でも**`Promise<Document>` を返す関数**でも可。関数の場合は `generateOpenapi` に**同じ** `WebApp`（`app`）を渡す。そうしないとドキュメント上の security / envelope が実環境とずれる。

`enable` を関数にすると引数でリクエストコンテキストを取れ、社内向けの門番に使える。戻り値が boolean なら型チェックで担保される。

## uriPrefix と本番の enable

| オプション / 書き方 | いつ使う |
| --- | --- |
| `openapi: './openapi.json'` | CI の `aomex openapi` 出力後にホスト |
| `openapi: () => generateOpenapi(...)` | 契約ファイルをコミットしない；同じ `app` を渡す |
| `uriPrefix` | デフォルト `/swagger` を変更；**ランダムな文字列**を含めるとスキャン後の悪用リスクを下げやすい |
| `enable` | 本番をパブリックから閉じる、または token / IP 許可リスト |

デフォルトの `/swagger`、`/redoc`、`/scalar` は当たりやすい。スキャフォールドは `/swagger-7c3e9a1f02b48d6e` のような接頭辞になる——よくあるパスをスキャンしてもページは出ない。ランダム文字列は**認可ではない**が、偶然当たるコストは上がる。パブリックでは `enable`、社内網、ゲートウェイと併用する。

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
});
```

本番でアクセス制限を足す：

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

載せる位置：通常 routers の前後どちらでも動くが、**業務 API の接頭辞と衝突させない**。redocUI / scalarUI と同時運用時はそれぞれ `uriPrefix` を分ける（ランダム文字列推奨）。

::: warning
パブリックに Swagger を晒すと API の地図と Try it out を一緒に渡すことになる。ランダム接頭辞と `enable` / ネットワーク分離をセットで使う。
:::

動的 `openapi: () => generateOpenapi(...)` で本番と同じ `app` を渡し忘れると、ページは「認証不要」・ラップ形状欠落なのに実呼び出しは 401。静的 openapi.json モードでコードだけ変えてファイルを更新しないと、UI は古い契約のまま。

Redoc / Scalar との比較、併存、シナリオ選定は [ドキュメント UI の選び方](/ja/openapi/choose-ui)。

## 関連

- [ドキュメント UI の選び方](/ja/openapi/choose-ui)
- [Scalar UI](/ja/openapi/scalar-ui) · [Redoc UI](/ja/openapi/redoc-ui)
- [生成OpenAPI](/ja/openapi/)