---
outline: deep
---

# OpenAPI ドキュメント生成

ルートで**契約を宣言**し、**ルートを走査して OpenAPI 3.0 を出力**する。連携先や CI 向け。Swagger / Redoc は「JSON の読み方」だけ——生成本体は `@aomex/openapi`。Web プロセスでは `generateOpenapi`、ファイル落としは [Console での出力](/ja/console/openapi)。

`query` / `body` / `response` を載せないルートは、ドキュメント上も対応セクションが空になる。実行時は動くが契約は欠ける。send / throw の型狭めは [制約付きレスポンス](/ja/web/response)。

```bash
pnpm add @aomex/openapi
```

一覧・詳細などのルートにバリデータと `response()` を載せ、`generateOpenapi` で提出可能な `openapi.json`（またはメモリ上の Document）を得る。**本番と同じ `WebApp` インスタンス**（`app`）を渡すと、グローバル `mount` と `envelope` を読み込み、security・エラー体・エンベロープが実環境とずれにくい。

## ルートに response と docs を載せる

契約はルート宣言から来る。`query` / `body` / `params` が入参 schema、`response()` が各ステータス出口、`docs` が summary と tags。実行時検証と型狭めはドキュメントと同源。欠けたセクションは openapi.json でも空のまま。

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

## `app` を渡して Document を生成

`generateOpenapi` が要るのは **`WebApp` インスタンス**。`mount` 配列を別途渡す方式ではない。`app` からグローバルミドルウェアと [レスポンスエンベロープ](/ja/web/envelope) を読み、OpenAPI 注入の単一の真実の源にする。

CLI・テスト・スクリプトがモジュールを `import` するときは、`new WebApp(...)` と `app.listen(...)` を**分ける**（listen は本当のプロセス入口だけ）。さもないと import 時に副作用でサーバが立ち、ポートを奪う。

```typescript
// src/app.ts —— 作成と export のみ。listen しない
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
// src/main.ts —— プロセス入口だけがポートを listen
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

- ルートに body / query / params を載せると、action 内の `ctx.body`、`ctx.query` などは既に狭い型になる。ドキュメント schema と同源。
- `response({ statusCode, content })` のあと、`ctx.send(200, …)` の第 2 引数は content と一致させる。200 を宣言して send(201) すると多くの場合型エラーになる。
- 手書きの `openapi.onMethod` だけでレスポンスを足す場合は、**生成 JSON に多く影響するだけ**で `ctx.send` は自動狭めにならない。そのときは型を自分で確認する。

`response()` のよく使うフィールド：

| フィールド | いつ使う |
| --- | --- |
| `statusCode` | 出口ごとに 1 回（200 / 201 / 204 / 404…） |
| `content` | JSON 成功体。ついで `ctx.send` も狭める |
| `contentType` | CSV、HTML、バイナリなど非デフォルト JSON |
| `headers` | `X-Request-Id` などをドキュメント化 |
| `example` | ドキュメントサイトの例。実行時は影響なし |

非 JSON の例：

```typescript
response({
  statusCode: 200,
  contentType: 'text/csv', // [!code highlight]
  content: rule.string(),
  description: '导出 CSV',
});
```

バリデータが覆えない少数のレスポンス（バイナリストリームなど）は、当該ルートに `openapi.onMethod` 付きミドルウェアを載せ、生成結果だけ変更する：

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

## generateOpenapi と実行時の出口

`generateOpenapi` はルートディレクトリを読み、`app` からグローバル `mount` / `envelope` を取り、メモリ上で OpenAPI Document を組み立てる。ファイル書き込み、Swagger / ReDoc 埋め込み、CI diff に使える。**HTTP は起動しない**。実行時の `ctx` 狭めは自動ではなく、ルート上の mount 次第。

| `generateOpenapi` オプション | いつ使う |
| --- | --- |
| `routers` | 必須。Web のルート走査と同じ glob |
| `app` | 本番と同じ `WebApp` インスタンス（mount・envelope を含む） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | `servers`、連絡先、ベンダー拡張。単一レスポンスはルートの `response()` を優先 |

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

リクエストのたびにルート走査する。アクセスが多いならキャッシュするか、CI 落とし + 静的ファイルに切り替える。

::: warning
`generateOpenapi` の `app` は**必須**（型定義上も）。本番と**同じ設定**（同一インスタンスがいちばん楽）。省略するとコンパイルを通らない。別の mount / envelope を渡すと、ドキュメント上の認証・formatError・エンベロープが実環境と合わなくなる。
:::

::: tip
Console 落としやスクリプト生成は Web モジュールを import する。`new WebApp` と `app.listen` を分け、CLI 実行で HTTP が立ち上がらないようにする。
:::

CI / ローカルで**固定ファイル**にするなら Console の `openapi()` + `aomex openapi`。[OpenAPI のファイル出力](/ja/console/openapi) を参照。

ブラウザで契約を開く：[Swagger UI](/ja/plugins/swagger-ui) · [Redoc UI](/ja/plugins/redoc-ui)。

ルートに載せられる response は `response()` で維持する。`fix` だけで全行手修正しない。`docs.summary` / `tags` を忘れても生成は動くが、読む側は苦しくなる。JSON を返すルートは多く `docs.showInOpenapi: false` にし、自分自身を再帰記述しない。

## 関連

- [制約付きレスポンス](/ja/web/response)
- [レスポンスエンベロープ](/ja/web/envelope)（`app` 渡しで成否を 200 に収める）
- [エラーフォーマット](/ja/web/errors)
- [OpenAPI のファイル出力](/ja/console/openapi)
- [Swagger UI](/ja/plugins/swagger-ui) · [Redoc UI](/ja/plugins/redoc-ui)