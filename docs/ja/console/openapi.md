---
outline: deep
---

# OpenAPI 書き出し

**HTTP プロセスを変えず**、Console コマンド1本でルートからスキャンした契約を**ファイルに書く**。CI、SDK、ドキュメントサイト向け。ルート宣言と `generateOpenapi` は Web 側の [OpenAPI 生成](/ja/plugins/openapi) を参照。

```bash
pnpm add @aomex/openapi
```
`ConsoleApp` の `mount` に `openapi({ routers, app, saveToFile, … })` を載せ、ローカルかパイプラインで `aomex openapi` を実行すると `openapi.json`（または指定パス）ができる。`app` には本番と同じ `WebApp` を渡すと、グローバルミドルウェアと [envelope](/ja/web/envelope) が契約に入る。

`app` を渡すときは `new WebApp(...)` と `app.listen(...)` を**分ける**（または listen は入口だけ）。さもないと Console が Web モジュールを import したときに副作用でサーバーが立つ。

```typescript
// src/app.ts —— 只导出 WebApp，不 listen
import { formatError, routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

export const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [formatError({ /* … */ }), routers('./src/routers')],
});
```

```typescript
// src/cli.ts
import { openapi } from '@aomex/openapi';
import { commanders, ConsoleApp } from '@aomex/console';
import { app } from './app.js';

new ConsoleApp({
  services,
  logger: services.logger,
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
成功するとカレント（または設定パス）に契約ファイルができる。

Console 側は主に**バッチでファイル書き出し**。Web ルートのように ctx を絞らない。業務ルートの body / response は従来どおりコンパイル時に action を絞る。書き出しコマンドは同じルート定義 + `app` のグローバル設定を読んで JSON を生成するだけ。

::: warning
`saveToFile` のパスは CI 成果物ディレクトリと揃える。さもないとパイプラインがファイルを見つけず、下流 SDK が古い契約のまま。ルートや `app` の mount / envelope を変えたら `aomex openapi` を忘れず、リポジトリの契約ファイルが乖離しないようにする。
:::

## routers と app

書き出しコマンドは HTTP を起動しないが、契約生成時に**本番と同じ**ルートディレクトリと同じ `WebApp`（認証、formatError、envelope はここから）を読む。`routers` は Web と同じ glob。`app` を渡さないと、ドキュメントの security、エラー体、ラップ形状が実レスポンスとずれやすい。

| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `routers` | 必須。Web と同じ glob | — |
| `app` | 本番と同じ `WebApp` インスタンス | — |
| `docs` | `info.title` / `version` / `description` | — |
| `fix` | servers、連絡先などドキュメント級フィールド | — |
| `saveToFile` | 書き出しパス。CI アーカイブ | `openapi.json` |

CI アーカイブ例：

```typescript
import { app } from './app.js';

openapi({
  routers: './src/routers',
  app,
  saveToFile: 'artifacts/openapi.json', // [!code highlight]
  docs: {
    info: { title: 'My API', version: '1.0.0' },
  },
  fix: (doc) => {
    doc.servers = [{ url: 'https://api.example.com' }];
    return;
  },
});
```
## 書き出し vs 実行時 JSON

| 場面 | やり方 |
| --- | --- |
| CI が毎ビルドで契約をアーカイブ | 本ページ：`openapi()` + `aomex openapi` |
| ルート変更後ローカルでファイル更新 | 同上、手動で1回 |
| 実行時に最新 JSON をリクエストごと返す | Web ルートで `generateOpenapi({ routers, app })`。Console 経由不要 |

生成ファイルは [Swagger UI](/ja/plugins/swagger-ui) / [Redoc UI](/ja/plugins/redoc-ui) へ、またはリポジトリにコミットして契約テスト。

書き出しと実行時の動的 `/openapi.json` は別物。本番で高頻度オンラインスキャンは CPU を食う。多くは書き出し + 静的配信か UI プラグインがファイルを読む。

## 関連

- [OpenAPI 生成](/ja/plugins/openapi)
- [レスポンスエンベロープ](/ja/web/envelope)
- [Swagger UI](/ja/plugins/swagger-ui)
- [Redoc UI](/ja/plugins/redoc-ui)
