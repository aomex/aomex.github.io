---
outline: deep
---

# カスタムミドルウェア

[ミドルウェア](/ja/core/middleware) の `middleware.mixin`、`.skip()`（関数または `boolean`）、`dependsOn`（上流の型だけ借りる）は日常の組み合わせで足りる。このページに来るのは、**実行時に何かする**だけでなく、**OpenAPI / CLI ヘルプ生成時に契約へ一行書きたい**——同じミドルウェアに両方を書き、一箇所の変更で両方が変わるようにしたいとき。

以下は「まず Web ドキュメントフック → Console ヘルプ → 最後にステージ横断再利用」の順。最後までやれば、マウントするだけで Swagger に効く trace ミドルウェアができる。

## 先に区別：mixin か web / console か

| 欲しい効果 | 使うもの |
| --- | --- |
| 実行時 `ctx` だけ変え、ドキュメントは不要 | `middleware.mixin`（[ミドルウェア](/ja/core/middleware)） |
| Web：実行時 + OpenAPI operation を変える | `middleware.web({ fn, openapi })` |
| Console：実行時 + `--help` ツリーに貢献 | `middleware.console({ fn, help })` |

`middleware.web` のインスタンスは Console に**直接**マウントできない。逆も同様。両方必要なら、共通ロジックを通常関数に抜き、それぞれ包む。

## ステップ1：まず動く実行時を書く

目標：各リクエストに `traceId` を付け、下流 action が読めるようにする。

```typescript
// src/middlewares/trace-id.ts
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{ // [!code highlight]
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    await next();
  },
});
```
ジェネリック `{ readonly traceId: string }` を `middleware.web` に付けると、**それより後のミドルウェアと同一ルートの action** で `ctx.traceId` が補完される。代入だけでジェネリックを書かないと、実行時にはあっても TypeScript は存在しないとみなす。

アプリやルートにマウントして試す：

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from './middlewares/trace-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
action: async (ctx) => {
  await services.logger.info('ok', { traceId: ctx.traceId });
  ctx.send({ ok: true });
};
```
この時点では Swagger に trace の説明はまだ出ない——実行時とドキュメントは別注入。

## ステップ2：OpenAPI フックを足す

同じ `middleware.web` の引数オブジェクトに `openapi` を追加。ドキュメント生成がルートを走査するとき、フレームワークがこれらのフックを呼び、現在の operation（または document 全体）を変更できる。

よく使う入口（型ヒントから選べばよく、全部書く必要はない）：

| フック | いつ使うか |
| --- | --- |
| `onMethod` | **この1本**の operation にパラメータ、レスポンス、security を足す |
| `postMethod` | 他が先に書いたあと仕上げ（例：共通エンベロープ） |
| `onDocument` | `components.securitySchemes` など全体ブロックを登録 |

`traceId` を載せた各 API にレスポンスヘッダ説明を足す：

```typescript
import { middleware } from '@aomex/common';

export const traceId = middleware.web<{
  readonly traceId: string;
}>({
  fn: async (ctx, next) => {
    ctx.traceId = crypto.randomUUID();
    ctx.response.setHeader('X-Trace-Id', ctx.traceId);
    await next();
  },
  openapi: { // [!code focus:14]
    onMethod(methodItem) {
      methodItem.responses ||= {};
      const ok = methodItem.responses['200'];
      if (ok && typeof ok === 'object' && 'description' in ok) {
        ok.headers ||= {};
        ok.headers['X-Trace-Id'] = {
          schema: { type: 'string', format: 'uuid' },
          description: '请求追踪 ID',
        };
      }
    },
  },
});
```
[OpenAPI 生成](/ja/plugins/openapi) を再実行するか Swagger を開く：このミドルウェアをマウントした operation に `X-Trace-Id` が見えるはず。フックの構造ミスは `pnpm start` では怒られない。生成結果で確認する。

::: tip
ミドルウェアが**実行時に何もしない**のにドキュメントだけ変えたいなら、ルート `docs` やジェネレータ設定で足せないか先に考える——空回りの1層は mount を読みにくくする。
:::

## ステップ3：Console 側も同じパターン

コマンドの `--help` に説明を差し込むときは `middleware.console` + `help`：

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 按类型提示往帮助树贡献说明；具体字段以编辑器补全为准
    },
  },
});
```
`commander.create` の `mount` に載せる。Web の `openapi` と対称：HTTP 契約か CLI ヘルプかの違いだけ。

## ステップ4：同じロジックを両ステージで共有

UUID ロジックを二重に書かない。関数に抜き、包む：

```typescript
import { middleware } from '@aomex/common';

const assignTraceId = (ctx: { traceId: string }) => {
  ctx.traceId = crypto.randomUUID();
};

export const webTraceId = middleware.web<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
  openapi: {
    /* 同上 */
  },
});

export const consoleTraceId = middleware.console<{ readonly traceId: string }>({
  fn: async (ctx, next) => {
    assignTraceId(ctx);
    await next();
  },
});
```
## 設定を間違えると

| 現象 | 多くは原因 |
| --- | --- |
| action に `ctx.traceId` 補全がない | `middleware.web` / `mixin` の Props ジェネリック漏れ |
| 実行時に header はあるが Swagger にない | `fn` だけ書いて `openapi` を忘れた、または生成時にそのミドルウェアをマウントしたルートを走査していない |
| Console に `middleware.web` をマウントして型エラー | ステージ違い。`middleware.console` に換える |
| ヘルスチェックがまだ認証で止まる | `.skip()`。[ミドルウェア · skip](/ja/core/middleware#skip-で特定リクエストを迂回) |

## 関連

- 順序、`.skip()`、`dependsOn`、ctx のマージ：[ミドルウェア](/ja/core/middleware)
- 既成プラグイン：[アクセスログ](/ja/plugins/http-access-log)、[認証統一エントリ Auth](/ja/plugins/auth)
- ドキュメント生成：[OpenAPI 生成](/ja/plugins/openapi)
