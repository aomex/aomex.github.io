---
outline: deep
---

# OpenAPI ドキュメント生成

ルートで**契約を宣言**し、**ルートを走査して OpenAPI 3.0 を出力**。連携先や CI 向け。Swagger / Redoc は「JSON の読み方」——生成本体は `@aomex/openapi`。Web プロセスでは `generateOpenapi`；ファイルへ書き出すは [Console での出力](/ja/console/openapi)。

query / body / response を載せないルートはドキュメント上も空——実行時は動くが契約は欠ける。send / throw の型狭めは [制約付きレスポンス](/ja/web/response)。

```bash
pnpm add @aomex/openapi
```

一覧・詳細ルートにバリデータと `response()` を載せ、`generateOpenapi` で提出可能な `openapi.json`（またはメモリ上の Document）。**本番と同じ `WebApp` インスタンス**（`app`）を渡すと `mount` と `envelope` を読み、security・エラー体・エンベロープが実環境とずれにくい。

## ルートに response と docs

契約はルート宣言から：`query` / `body` / `params` が入参 schema、`response()` が各ステータス出口、`docs` が summary と tags。実行時検証と型狭めはドキュメントと同源。欠けた段は openapi.json でも空。

```typescript
// src/routers/user.ts
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

export const router = new Router({
  prefix: '/users',
  docs: { tags: ['User'] },
});

router.get('/', {
  docs: { summary: '用户列表' },
  mount: [query({ page: rule.int().min(1).default(1) })],
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', { // [!code focus:14]
  docs: { summary: '用户详情' },
  mount: [
    response({ // [!code highlight]
      statusCode: 200,
      description: '找到用户',
      content: { id: rule.int(), name: rule.string() },
    }),
    response({ statusCode: 404, description: '不存在' }),
  ],
  action: async (ctx) => {
    // …
  },
});
```

## app を渡して Document 生成

`generateOpenapi` が要るのは **`WebApp` インスタンス**。別の `mount` 配列は渡さない。`app` からグローバルミドルウェアと [レスポンスエンベロープ](/ja/web/envelope) を読み、OpenAPI 注入の単一の真実源にする。

CLI・テスト・スクリプトがこのモジュールを import するなら `new WebApp(...)` と `app.listen(...)` を**分離**（本当のプロセス入口だけ listen）。import の副作用で起動・ポート奪いを防ぐ。

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:12]
    formatError({
      content: { code: rule.string(), message: rule.string() },
      handler(err) {
        return {
          code: err.code ?? 'ERROR',
          message: err.message,
        };
      },
    }),
    routers('./src/routers'),
  ],
});
```

```typescript
// src/main.ts —— 进程入口才听端口
import { app } from './app.js';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

const document = await generateOpenapi({ // [!code focus:11]
  routers: './src/routers',
  app, // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});

await writeFile('openapi.json', JSON.stringify(document, null, 2));
```

- ルートに body / query / params を載せると ctx.body、ctx.query 等は action で既に狭い型——ドキュメント schema と同源。
- `response({ statusCode, content })` 後、`ctx.send(200, …)` の第 2 引数は content と一致。200 宣言で send(201) は多く型エラー。
- 手書き `openapi.onMethod` でだけ補うレスポンスは**生成 JSON に多くだけ影響**し ctx.send は狭めない——その場合は型を自分で見る。

`response()` 常用フィールド：

| フィールド | いつ使う |
| --- | --- |
| `statusCode` | 出口ごとに 1 回（200 / 201 / 204 / 404…） |
| `content` | JSON 成功体。ついで `ctx.send` も狭める |
| `contentType` | CSV、HTML、バイナリ等非デフォルト JSON |
| `headers` | `X-Request-Id` 等をドキュメント化 |
| `example` | ドキュメントサイトの例。実行時は影響なし |

非 JSON 例：

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

バリデータが覆えない少数レスポンス（バイナリストリーム等）は、当該ルートに `openapi.onMethod` 付きミドルウェアを載せ、生成結果だけ変更：

```typescript
import { middleware } from '@aomex/common';

export const openapiBinaryFile = middleware.web({ // [!code focus:18]
  fn: async (_ctx, next) => {
    return next();
  },
  openapi: {
    onMethod(methodItem) { // [!code highlight]
      methodItem.responses ||= {};
      methodItem.responses['200'] = {
        description: '文件流',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' },
          },
        },
      };
    },
  },
});
```

## generateOpenapi と実行時出口

`generateOpenapi` はルートディレクトリを読み、`app` からグローバル `mount` / `envelope` を取り、メモリ上で OpenAPI Document を組み立てる。ファイル化、Swagger/ReDoc 埋め込み、CI diff に使える。**HTTP は起動しない**。実行時 ctx の狭めは自動ではなくルート mount 次第。

| `generateOpenapi` オプション | いつ使う |
| --- | --- |
| `routers` | 必須。Web のルート走査と同じ glob |
| `app` | 本番と同じ `WebApp`（mount、envelope 込み） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | `servers`、連絡先、ベンダー拡張。単一レスポンスはルート `response()` 優先 |

実行時に仕様を動的返す（自前 `/openapi.json`）：

```typescript
import { app } from '../app.js';

router.get('/openapi.json', {
  docs: { showInOpenapi: false },
  action: async (ctx) => {
    const document = await generateOpenapi({ // [!code highlight]
      routers: './src/routers',
      app,
    });
    ctx.send(document);
  },
});
```

リクエストごとにルート走査——アクセス多いならキャッシュ、または CI 出力 + 静的ファイル。

::: warning
`generateOpenapi` の `app` は本番と**同じ設定**（同一インスタンスが楽）。`routers` だけで `app` なしだと、グローバル認証、formatError、envelope 等がドキュメントに欠け、联調が合わない。
:::

::: tip
Console 出力・スクリプト生成は Web モジュールを import する：`new WebApp` と `app.listen` を分け、CLI 実行で HTTP が立ち上がらないようにする。
:::

CI / ローカル**固定ファイル**は Console：`openapi()` + `aomex openapi`。 [OpenAPI のファイル出力](/ja/console/openapi) 参照。

ブラウザで契約を開く：[Swagger UI](/ja/plugins/swagger-ui) · [Redoc UI](/ja/plugins/redoc-ui)。

ルートに載せられる response は `response()` で維持。fix だけで全行手修正しない。docs.summary / tags 忘れても生成は動くが、読む側が苦しい。JSON を返すルートは多く `docs.showInOpenapi: false` で自分自身の再帰記述を避ける。

## 関連

- [制約付きレスポンス](/ja/web/response)
- [レスポンスエンベロープ](/ja/web/envelope)（`app` 渡しで成否を 200 に収める）
- [エラーフォーマット](/ja/web/errors)
- [OpenAPI のファイル出力](/ja/console/openapi)
- [Swagger UI](/ja/plugins/swagger-ui) · [Redoc UI](/ja/plugins/redoc-ui)