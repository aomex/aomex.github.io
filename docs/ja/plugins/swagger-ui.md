---
outline: deep
---

# Swagger UI

ローカルまたは社内に**開いて試せる** API ドキュメント。前提は OpenAPI Document（ファイル出力した openapi.json または実行時 `generateOpenapi`）。長文は [Redoc UI](/ja/plugins/redoc-ui)。両方同居可。**プレフィックス衝突注意**。

契約の出所：[OpenAPI 生成](/ja/plugins/openapi) · [OpenAPI のファイル出力](/ja/console/openapi)。

```bash
pnpm add @aomex/swagger-ui
```

`WebApp.mount` に swaggerUI。開発者は /swagger（または設定 prefix）で閲覧と Try it out。

## ファイル出力または動的 generateOpenapi

**CI でファイル出力済み**（一般的）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

ブラウザ：/swagger（または /swagger/index.html）。仕様 JSON は多く同プレフィックス下 openapi.json。

**本番ルートと同期**（静的ファイルを維持しない）：

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

swaggerUI は mount 内。型上は通常 Web ミドルウェア。業務ルートの推論は変えない。openapi は**パス文字列**か `Promise<Document>` を返す関数。**本番と同じ** `WebApp`（`app`）を `generateOpenapi` に渡す。さもないと security / envelope が実環境と二重皮。

enable を関数にすると引数でリクエストコンテキスト取得。社内ゲート向き——戻り boolean は型チェックで支えられる。

## uriPrefix と本番 enable

| オプション / 書き方 | いつ使う |
| --- | --- |
| `openapi: './openapi.json'` | CI `aomex openapi` ファイル出力後ホスト |
| `openapi: () => generateOpenapi(...)` | 契約ファイルをコミット不要。同じ `app` を渡す |
| `uriPrefix` | 既定 `/swagger` を避けたいとき |
| `enable` | 本番公開でドキュメントを閉じる、token / IP ホワイトリスト |

本番制限例：

```typescript
swaggerUI({
  openapi: './openapi.json',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

載せる位置：routers の前後どちらも多いが**業務 API プレフィックスと衝突しない**（業務も /docs だと uriPrefix: '/docs' と奪い合い）。redocUI 同時起動時 uriPrefix を分ける。

::: warning
インターネット公開のまま Swagger は API 地図と Try it out を一緒に渡す。最低 enable かネットワーク分離。

:::

動的 `openapi: () => generateOpenapi(...)` で本番と同じ `app` を忘れると UI は「認証不要」、エンベロープも欠け、実際は 401。静的 openapi.json モードでコードだけ変えファイル更新しないと UI は古い契約。

## 関連

- [Redoc UI](/ja/plugins/redoc-ui)
- [OpenAPI 生成](/ja/plugins/openapi)
- [OpenAPI のファイル出力](/ja/console/openapi)