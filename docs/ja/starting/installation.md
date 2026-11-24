---
outline: deep
---

# クイックインストール

ゼロから動く aomex プロジェクトを起こす。HTTP にアクセスでき、端末でも指令を走らせられる。スキャフォールドが logger / language / シャットダウンなど必須項目を揃えるので、手組みより楽。スキャフォールドは **Node.js `^22.22.2 || ^24.15.0 || >=26`** が必要。

どのコマンドで起動するかで、対応するパッケージマネージャが自動で選ばれる（`--pm` で上書き可）。

```bash
pnpm create aomex
yarn create aomex
npm create aomex
```

案内に従って ORM、認証、ミドルウェアなどを選ぶ。生成後にディレクトリへ入り起動：

```bash
cd <project>
pnpm start   # 或 yarn start / npm start
```

生成プロジェクトのルートに `AGENTS.md` → `aomex-skill.md` があり、AI が約束どおりコードを拡張するのに使う。

起動したらブラウザでヘルスチェックかホームを叩く（ポートはテンプレートの PORT）。端末側：

```bash
pnpm aomex -h
```

## 非対話パラメータ

すべてのオプションは CLI 引数で質問を飛ばせる（スクリプト / CI 向け）。渡していない項目は引き続き対話で尋ねる。

| パラメータ | 説明 | 例 |
| --- | --- | --- |
| `--project` | プロジェクトディレクトリ名 | `--project=my-api` |
| `--node` | Node バージョン（未指定なら対話で LTS を選択、≥24） | `--node=24.22.0` |
| `--pm` | パッケージマネージャ（デフォルトは create コマンドに従う） | `--pm=pnpm` \| `yarn` \| `npm` |
| `--orm` | ORM | `--orm=prisma` \| `mongoose` \| `none` |
| `--db` | Prisma データベース（`--orm=prisma` のときだけ） | `--db=mysql` \| `postgresql` \| … |
| `--auth` | 認証ストラテジー。カンマで複数。`none` は無し | `--auth=bearer,jwt` \| `--auth=none` |
| `--web-plugins` | 任意の Web ミドルウェア（`cors` / `etag` / `helmet` / `response-time` は常にインストール） | `--web-plugins=access-log,async-trace` |
| `--docs` | ドキュメント UI | `--docs=swagger` \| `redoc` \| `scalar` \| `none` |
| `--logger` | ログ出口。カンマで複数 | `--logger=console,file` |
| `--console-middlewares` | Console プラグイン。`cron` は常にインストール。追加可 | `--console-middlewares=openapi` |
| `--lang` | デフォルト言語（BCP 47） | `--lang=zh-CN` |
| `--docker` | Docker 本番デプロイ成果物を生成するか | `--docker=true` \| `false` |
| `--tz` / `--timezone` | プロセスのタイムゾーン | `--tz=Asia/Shanghai` |
| `--cluster` | クラスタ方式（重ねない） | `--cluster=none` \| `cluster-listen` \| `pm2` |

```bash
pnpm create aomex -- \
  --project=HelloAomex \
  --pm=pnpm \
  --orm=prisma \
  --db=mysql \
  --auth=bearer \
  --docs=swagger \
  --lang=zh-CN \
  --docker=true \
  --tz=Asia/Shanghai \
  --web-plugins=access-log,async-trace \
  --logger=console,file \
  --cluster=none
```

## ディレクトリ構成

スキャフォールドはだいたいこうなる（バージョンで微調整あり）。まず三本の線を掴む：`src/web.ts` が HTTP、`src/cli.ts` が端末 / Cron / OpenAPI のファイル出力、`src/routers/` と `src/commanders/` がそれぞれ API と指令。認証・エラー形式・アクセスログなど再利用ミドルウェアは `src/middleware/`、DB 照会・キャッシュは `src/services/` に置き、**両方で共有**する。

| ファイル / ディレクトリ | 何のために直すか |
| --- | --- |
| `src/web.ts` | HTTP を起こす |
| `src/cli.ts` | 端末指令 / Cron / OpenAPI のファイル出力を起こす |
| `src/routers/` | API を書く |
| `src/commanders/` | CLI 指令を書く |
| `src/middleware/` | 認証、formatError、アクセスログ、Swagger など再利用ミドルウェア。`web.ts` / ルート mount に載せる |
| `src/services/` | DB 照会、キャッシュ、メール——業務 SQL をルート `action` に詰め込まない |
| `src/schemas/` | 再利用バリデーション。ファイル名 `xxx.schema.ts`（OpenAPI と CLI が同じ一式を共有） |

使わないもの（prisma、i18n…）は消してよい。体裁のため残す必要はない。CORS、認証、OpenAPI などは独立パッケージ。使うときに入れる。

## インターフェースを 1 本試す

スキャフォールドにはすでに `src/routers/` がある。新しいファイルで `export const router = new Router()`。`routers('./src/routers')` が掃き込む。先に検証してから action：

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

`pnpm start` のあと `/hello?name=ada` にアクセス。このとき `ctx.query.name` はすでに string。

## 指令を 1 本試す

Console と Web は services / schemas を**共有**する。`src/commanders/` の指令を直すか、スキャフォールド同梱のものをそのまま走らせる：

```bash
pnpm aomex hello
pnpm aomex hello --user Ada
```

定期タスク、OpenAPI のファイル出力も `src/cli.ts` を通る。[Cron](/ja/plugins/cron) · [OpenAPI 生成](/ja/openapi/) を参照。

## 次のステップ

1. [Web アプリ入口](/ja/web/) — `WebApp` の必須項目、language、シャットダウン  
2. [インターフェースルート](/ja/web/router) — mount、docs、disabled  
3. [検証器](/ja/validators/) — フィールドの検証と型の絞り込み  
4. [サービス層](/ja/core/service) — DB 照会・キャッシュの置き場  
5. [Console アプリ入口](/ja/console/) — 指令と Cron
