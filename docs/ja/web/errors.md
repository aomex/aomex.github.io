---
outline: deep
---

# エラー形式

`ctx.throw` をサイト（またはモジュール）全体で統一 JSON エンベロープにし、デフォルトプレーンテキストにしない：mount に `formatError`、handler で最終 body、content で型と OpenAPI を固定。形状変更はここ。`app.on('error')` で body を直さない——タイミングが遅く、既に書き始めたレスポンスと競合しやすい。

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/ja/web/)
  mount: [
    formatError({ // [!code focus:13]
      content: { // [!code highlight]
        code: rule.string(),
        message: rule.string(),
      },
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
`formatError` は `routers`**の外・手前**にマウント。内側で拾われなければ任意ルートの throw がこの handler へ。

handler 戻り値は content と一致。`ctx.throw(403, { code: 'FORBIDDEN' })` では業務コードは多く `err.code`、文言はサニタイズ済み `err.message`。`statusCodes` 省略時、この層が**すべて** 4xx / 5xx を受け持つ。ルート `response({ statusCode: 400 })` で content 未記述時、ドキュメントは外層 formatError のエラー形状を借りることが多い。formatError なしならクライアントはフレームワークデフォルトのプレーンテキスト。

引き継ぎ時は既存レスポンスヘッダをクリアし、エラーコードでステータス再設定して新 body を send。`err.raw`、スタック、SQL を handler 返却に入れない——外向きはサニタイズ済み情報のみ。

## モジュール内側エンベロープ

グローバル formatError はサイトデフォルト。**/admin** や公開 API サブドメインで別フィールド名（`error` / `detail` で `code` / `message` 以外）なら、該当 `Router({ mount: [formatError(...)] })` に内層を追加。オニオン内側が先に catch。`/admin/*` は内層、他は外層。

/admin で別フィールド名：

```typescript
import { formatError, Router } from '@aomex/web';

const adminRouter = new Router({ // [!code focus:18]
  prefix: '/admin',
  mount: [
    formatError({ // [!code highlight]
      content: {
        error: rule.string(),
        detail: rule.string().optional(),
      },
      handler(err) {
        return {
          error: err.code ?? 'ADMIN_ERROR',
          detail: err.message,
        };
      },
    }),
    auth.authenticate('bearer'),
  ],
});
```
オニオンで**内側が先に catch**：`/admin/*` は内層形状、他ルートはグローバル。

## statusCodes で部分受け持ち

`statusCodes` で**この層**が処理する HTTP コードを限定（多くは 400、422 など検証系のみ）。他 4xx / 5xx は外層 handler へ。「検証だけ統一 JSON、業務 403 はグローバル」の分担。

検証系だけ管轄：

```typescript
formatError({ // [!code highlight]
  statusCodes: [400, 422],
  content: {
    code: rule.string(),
    message: rule.string(),
  },
  handler(err) {
    return {
      code: err.code ?? 'VALIDATION',
      message: err.message,
    };
  },
}),
```
## ルート throw との連携

ルートで `ctx.throw(status, …)` が能動的終了。欠損 **404**、業務検証 **400**、権限 **403** など。第二引数は文字列か `code` 付きオブジェクト。formatError handler が `err` からコードと文言を content に組み立てる。

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```
業務で既にヘッダや body を誤書きしたあと throw するなら formatError に任せて丸ごと差し替え。action でエラー JSON を半分組み立てない。

成功体とエラー体をさらに `{ success, data, statusCode }` で包み外側 HTTP 固定 200 なら [レスポンスエンベロープ](/ja/web/envelope)（formatError と併用が多い）。

## 次のステップ

- [レスポンスエンベロープ](/ja/web/envelope)（統一外殻と HTTP 200）
- [レスポンス制約](/ja/web/response)（ルートごと 400/404 等）
- [アプリケーション入口](/ja/web/)（services / logger / language 等）
- [WebApp.language](/ja/web/#language)（検証・エラー文言の言語）
