---
outline: deep
---

# カスタムミドルウェア

[ミドルウェア](/ja/core/middleware) の `middleware.mixin`、`.skip()`（関数または `boolean`）、`dependsOn`（上流の型だけ借りる）で日常の組み合わせは足ります。本ページに来るのはたいてい、**ランタイムで動かしつつ OpenAPI / CLI ヘルプ生成時に契約へ 1 行書き足したい** — 同じミドルウェアに両方を書き、変更は一箇所で済ませたいからです。

「Web のドキュメントフック → Console のヘルプ → ステージ横断で再利用」の順で進めます。手を動かせば Swagger に効く trace ミドルウェアができます。

## 先に切り分け：mixin か web / console か

| 欲しい効果 | 使うもの |
| --- | --- |
| ランタイムの `ctx` だけ、ドキュメントは不要 | `middleware.mixin`（[ミドルウェア](/ja/core/middleware)） |
| Web：ランタイム + OpenAPI operation を変える | `middleware.web({ fn, openapi })` |
| Console：ランタイム + `--help` ツリーに寄与 | `middleware.console({ fn, help })` |

`middleware.web` のインスタンスは Console に**そのまま**載せられません。逆も同様。両方必要なら共通ロジックを通常関数に抜き、それぞれでラップします。

## ステップ 1：まず動くランタイムを書く

目標：各リクエストに `traceId` を載せ、下流 action が読めるようにする。

```typescript
// src/middleware/trace-id.ts
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

ジェネリック `{ readonly traceId: string }` を `middleware.web` に書いたあと、**それより後のミドルウェアと同じルートの action** で `ctx.traceId` が補完されます。代入だけでジェネリックを省略すると、実行時にはあっても TypeScript は存在しない扱いです。

アプリまたはルートに載せて試す：

```typescript
import { routers, WebApp } from '@aomex/web';
import { traceId } from '@/middlewares/trace-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [
    traceId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

```typescript
import { logger } from '@/services/logger.service';

action: async (ctx) => {
  logger.info(`ok ${ctx.traceId}`);
  ctx.send({ ok: true });
};
```

この時点では Swagger に trace の説明は出ません — ランタイムとドキュメントは別注入です。

## ステップ 2：OpenAPI フックを足す

同じ `middleware.web` の引数オブジェクトに `openapi` を追加します。ルートをスキャンしてドキュメント生成するとき、フレームワークがこれらのフックを呼び、現在の operation（または document 全体）を変更できます。

よく使う入口（型ヒントで選び、全部書く必要はありません）：

| フック | いつ使う |
| --- | --- |
| `onMethod` | **この 1 本**の operation にパラメータ・レスポンス・security |
| `postMethod` | 他が書き終えたあと仕上げ（例：共通エンベロープ） |
| `onDocument` | `components.securitySchemes` などグローバルブロック登録 |

`traceId` を載せた各 API にレスポンスヘッダーの説明を足す例：

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

[OpenAPI の生成](/ja/openapi/) を再実行するか Swagger を開く：このミドルウェアを載せた operation に `X-Trace-Id` が見えるはずです。フック内の構造ミスは `pnpm start` では出にくい — 生成結果で確認してください。

::: tip
ランタイムで**何もしない**ミドルウェアがドキュメントだけのためなら、ルートの `docs` やジェネレータ設定で足せないか先に検討 — 空の 1 層は mount を読みにくくします。
:::

## ステップ 3：Console 側も同じ型式

コマンドが `--help` に説明を足すときは `middleware.console` + `help`：

```typescript
import { middleware } from '@aomex/common';

export const withDryRunFlag = middleware.console({ // [!code highlight]
  fn: async (ctx, next) => {
    await next();
  },
  help: {
    onDocument(doc) {
      // 型ヒントどおりヘルプツリーに寄与；具体フィールドはエディタ補完に従う
    },
  },
});
```

`commander.create` の `mount` に載せます。Web の `openapi` と対称 — HTTP 契約と CLI ヘルプです。

## ステップ 4：両ステージで同じロジック

UUID ロジックを二重に書かない。関数に抜き、ラップする：

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

## 設定ミスで起きがちなこと

| 現象 | 原因のことが多い |
| --- | --- |
| action に `ctx.traceId` 補完なし | `middleware.web` / `mixin` に Props ジェネリック漏れ |
| 実行時はヘッダーあるが Swagger にない | `fn` だけで `openapi` 忘れ、または生成時にそのミドルウェアのルートがスキャンされていない |
| Console に `middleware.web` を載せて型エラー | ステージ違い、`middleware.console` に変更 |
| ヘルスチェックがまだ認証で止まる | `.skip()`、[ミドルウェア · skip](/ja/core/middleware#skip-で特定リクエストを迂回) |

## 関連

- 順序、`.skip()`、`dependsOn`、ctx のマージ：[ミドルウェア](/ja/core/middleware)
- 既成プラグイン：[アクセスログ](/ja/plugins/access-log)、[統一 Auth](/ja/plugins/auth)
- ドキュメント生成：[OpenAPI の生成](/ja/openapi/)