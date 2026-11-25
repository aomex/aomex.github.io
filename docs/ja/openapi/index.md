---
outline: deep
---

# OpenAPI を生成

ルートで**契約を宣言**し、走査して OpenAPI 3.0 にする。メモリ上でスクリプトや Swagger 用に使うか、Console 経由で**ファイルに落とし** CI や SDK 向けにする。生成パイプラインは `@aomex/openapi-generator`。Swagger / Redoc はその JSON の読み方のひとつに過ぎない。

`query` / `body` / `response` を載せないルートは、ドキュメント上の対応セクションも空になる。実行時は動くが、契約は欠ける。send / throw の型狭めは [制約付きレスポンス](/ja/web/response) を参照。

```bash
pnpm add @aomex/openapi-generator
```

**本番と同じ `WebApp` インスタンス**（`app`）を渡す。生成器はグローバル `mount` と `envelope` を読み、security・エラー体・エンベロープが実環境からずれにくくなる。

## ルートに response と docs を載せる

契約はルート宣言から来る。`query` / `body` / `params` が入参 schema、`response()` が各ステータスコードの出口、`docs` が summary と tags。実行時の検証と型狭めはドキュメントと同源。欠けたセクションは openapi.json 上でも空のまま。

グループの付け方や、既定のファイル名 tag の上書きは [タグ](/ja/openapi/tags) を参照。`info.description` やルートの長い説明の Markdown は [Markdown 記述](/ja/openapi/markdown) を参照。

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

CLI・テスト・スクリプトがモジュールを `import` するときは、`new WebApp(...)` と `app.listen(...)` を**分ける**（listen はプロセス入口だけ）。さもないと import 時に副作用でサーバが立ち、ポートを奪う。

```typescript
// src/app.ts —— 只创建并导出，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { rule } from '@aomex/common';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

export const app = new WebApp({
  services,
  logger,
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
import { app } from '@/app';

app.listen(3000);
```

```typescript
import { writeFile } from 'node:fs/promises';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

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
- `response({ statusCode, content })` のあと、`ctx.send(200, …)` の第 2 引数は content と一致させる。200 を宣言して send(201) すると、多くの場合型エラーになる。
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

## generateOpenapi のオプションと実行時の出口

`generateOpenapi` はルートディレクトリを読み、`app` からグローバル `mount` / `envelope` を取り、メモリ上で OpenAPI Document を組み立てる。ファイル書き込み、Swagger / ReDoc への埋め込み、CI diff に使える。**HTTP は起動しない**。実行時の `ctx` 狭めは自動ではなく、ルート上の mount 次第。

| `generateOpenapi` オプション | いつ使う |
| --- | --- |
| `routers` | 必須。Web のルート走査と同じ glob |
| `app` | 本番と同じ `WebApp` インスタンス（mount・envelope を含む） |
| `docs` | `info.title` / `version` / `description` |
| `fix` | `servers`、連絡先、ベンダー拡張。単一レスポンスはルートの `response()` を優先 |

実行時に動的に仕様を返す（自前の `/openapi.json`）：

```typescript
import { app } from '@/app';

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

リクエストのたびにルートを走査する。アクセスが多いならキャッシュするか、下記の Console 落とし＋静的ファイルに切り替える。

::: warning
`generateOpenapi` の `app` は**必須**（型定義上も）。本番と**同じ設定**（同一インスタンスがいちばん楽）。省略するとコンパイルを通らない。別の mount / envelope を渡すと、ドキュメント上の認証・formatError・エンベロープが実環境と合わなくなる。
:::

## Console 落とし：`openapi()` + `aomex openapi`

HTTP プロセスを変えず、契約を**ファイルに書きたい**ときは、`ConsoleApp` の mount に `openapi({ routers, app, saveToFile, … })` を載せ、`aomex openapi` を実行する。中身は同じ生成ロジックで、バッチとしてディスクに書く。

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi-generator';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from '@/app';
import { services } from '@/services';
import { logger } from '@/services/logger.service';

new ConsoleApp({
  services,
  logger,
  language: 'zh-CN',
  mount: [
    openapi({ // [!code focus:18]
      routers: './src/routers',
      app, // [!code highlight]
      saveToFile: 'openapi.json',
      docs: {
        info: {
          title: 'My API',
          version: '1.0.0',
        },
      },
      fix: (doc) => {
        doc.servers = [{ url: 'https://api.example.com' }];
        return;
      },
    }),
    commanders('./src/commanders'),
  ],
});
```

```bash
npx aomex openapi
# 脚手架里常见：pnpm aomex openapi
```

成功すると、カレントディレクトリ（または設定したパス）に契約ファイルができる。`routers` / `app` / `docs` / `fix` の意味は `generateOpenapi` と同じ。追加されるのは `saveToFile`（既定は `openapi.json`）。

::: tip
Console 落としやスクリプト生成は Web モジュールを import する。`new WebApp` と `app.listen` を分け、CLI 実行で HTTP が立ち上がらないようにする。
:::

::: warning
`saveToFile` のパスは CI 成果物ディレクトリと揃える。さもないとパイプラインがファイルを見つけられず、下流の SDK が古い契約のままになる。ルートや `app` の mount / envelope を変えたら `aomex openapi` を実行し、リポジトリ内の契約ファイルをずらしたままにしない。
:::

CI への成果物登録の例：

```typescript
openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
});
```

| シナリオ | やり方 |
| --- | --- |
| CI で毎ビルド契約を保管 | `openapi()` + `aomex openapi` |
| ルート変更後にローカルでファイル更新 | 同上を手動実行 |
| 実行時に最新 JSON をリクエストごとに返す | Web ルートから `generateOpenapi({ routers, app })` |
| 開発中にブラウザで試す | まず [ドキュメント UI の選び方](/ja/openapi/choose-ui) を読み、[Swagger](/ja/openapi/swagger-ui) / [Redoc](/ja/openapi/redoc-ui) / [Scalar](/ja/openapi/scalar-ui) で落としファイルまたは動的 `generateOpenapi` を読み込む |

落としと実行時の動的 `/openapi.json` は別物。高頻度のオンライン走査は CPU を食う。本番のドキュメントサイトは多く、落とし＋静的配信か UI プラグインがファイルを読む形になる。

ルートに載せられる response は `response()` で維持し、`fix` だけで各行を手修正しない。`docs.summary` / tags を忘れても生成は動くが、連携先がドキュメントを読むときはつらい——グループ分けと説明文は [タグ](/ja/openapi/tags) · [Markdown 記述](/ja/openapi/markdown) を参照。JSON を返すルートは多く `docs.showInOpenapi: false` にし、自分自身を再帰記述しない。

## 関連

- [タグ](/ja/openapi/tags)
- [Markdown 記述](/ja/openapi/markdown)
- [制約付きレスポンス](/ja/web/response)
- [レスポンスエンベロープ](/ja/web/envelope)（`app` 渡しで成否枝を 200 に収める；`skipEnvelope` のステータスコードはそのまま保持）
- [エラーフォーマット](/ja/web/errors)
- [ドキュメント UI の選び方](/ja/openapi/choose-ui) · [Swagger UI](/ja/openapi/swagger-ui) · [Redoc UI](/ja/openapi/redoc-ui) · [Scalar UI](/ja/openapi/scalar-ui)