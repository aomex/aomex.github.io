---
outline: deep
---

# クイックインストール

ゼロから動く aomex プロジェクトを立ち上げる：HTTP もターミナルコマンドも使える。スキャフォールドが logger / language / shutdown などの必須項目を揃えてくれるので、ゼロから組むより手早い。

スキャフォールドは **Node.js `^22.22.2 || ^24.15.0 || >=26`** が必要。必ず `@latest` を付けてください。どれで起動したかに応じて、対応するパッケージマネージャが選ばれます（`--pm` で上書き可）。

```bash
pnpm create aomex@latest
yarn create aomex@latest
npm create aomex@latest
```

プロンプトに従って ORM・認証・ミドルウェアなどを選び、生成後にディレクトリへ入って起動：

```bash
cd <project>
pnpm start   # または yarn start / npm start
```

生成プロジェクトのルートには `AGENTS.md` → `aomex-skill.md` があり、AI が規約に沿ってコードを拡張できます。

起動後、ブラウザでヘルスチェックやトップ（ポートはテンプレートの PORT を参照）。ターミナル側：

```bash
pnpm aomex -h
```

## ディレクトリ構成

スキャフォールドはおおよそ次の形（バージョンで微調整あり）。まず三つの線を押さえる：`src/web.ts` で HTTP、`src/cli.ts` でターミナル / Cron / OpenAPI 書き出し、`src/routers/` と `src/commanders/` に API と CLI を書く。認証、エラー形式、アクセスログなど再利用可能なミドルウェアは `src/middleware/` に置き、DB・キャッシュは `src/services/` に入れ、**Web / Console で共有**する。

| ファイル / ディレクトリ | 何のために触るか |
| --- | --- |
| `src/web.ts` | HTTP を起動 |
| `src/cli.ts` | ターミナルコマンド / Cron / OpenAPI 書き出し |
| `src/routers/` | API を書く |
| `src/commanders/` | CLI コマンドを書く |
| `src/middleware/` | 認証、formatError、アクセスログ、Swagger など再利用ミドルウェアを置き、`web.ts` / ルート mount に載せる |
| `src/services/` | DB、キャッシュ、メール送信——ビジネス SQL はルートの `action` に直書きしない |
| `src/schemas/` | 再利用可能な検証。ファイル名 `xxx.schema.ts`（OpenAPI と CLI で同じ定義） |
使わないもの（prisma、i18n など）は削除してよい。飾りで残す必要はない。CORS、認証、OpenAPI などは独立パッケージで、必要になってから入れる。

## インターフェースを1本試す

スキャフォールドに `src/routers/` がある。`export const router = new Router()` の新規ファイルを作れば、`routers('./src/routers')` が拾う。action の前に検証：

```typescript
// src/routers/hello.router.ts
import { rule } from '@aomex/common';
import { query, Router } from '@aomex/web';

export const router = new Router();

router.get('/hello', {
  mount: [
    query({ name: rule.string().default('world') }), // [!code highlight]
  ],
  action: async (ctx) => {
    ctx.send({ message: `hello, ${ctx.query.name}` });
  },
});
```
`pnpm start` のあと `/hello?name=ada` にアクセスすると、この時点で `ctx.query.name` は string になる。

## CLI コマンドを1本試す

Console は Web と **同じ** services / schemas を共有。`src/commanders/` を編集するか、付属コマンドをそのまま実行：

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```
Cron や OpenAPI 書き出しも `src/cli.ts` 経由。詳しくは [Cron](/ja/plugins/cron)・[OpenAPI 書き出し](/ja/openapi/)。

## 次のステップ

1. [Web アプリケーション入口](/ja/web/) — `WebApp` の必須項目、language、shutdown  
2. [インターフェースルーティング](/ja/web/router) — mount、docs、disabled  
3. [バリデータ](/ja/validators/) — フィールドの検証と型の絞り込み  
4. [サービス層](/ja/core/service) — DB・キャッシュの置き場所  
5. [Console アプリケーション入口](/ja/console/) — コマンドと Cron
