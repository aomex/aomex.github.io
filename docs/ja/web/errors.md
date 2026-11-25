---
outline: deep
---

# エラー形式

サイト全体（またはモジュール）の `ctx.throw` を統一 JSON にする：`mount` に `formatError` を掛け、`handler` で最終 body、`content` で型と OpenAPI を固定する。形状の変更はここで行い、`app.on('error')` で body を無理に書き換えない——タイミングが遅く、既に書き出した応答と衝突しやすい。

```typescript
import { rule } from '@aomex/common';
import { formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— [アプリ入口](/ja/web/) 参照
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

`formatError` は `routers` の**外側・手前**に掛ける。内側で捕まえられない限り、任意ルートの throw がこの handler に入る。

handler の戻り値は `content` の形に合わせる。`ctx.throw(403, { code: 'FORBIDDEN' })` では業務コードは多く `err.code`、文言はサニタイズ済み `err.message`。`statusCodes` を省略すると、この層が**すべて**の 4xx / 5xx を扱う。ルートの `response({ statusCode: 400 })` で `content` 未指定のとき、ドキュメント生成は外側 `formatError` のエラー形状を借りることが多い。`formatError` なしではクライアントはフレームワーク既定のプレーンテキストエラー。

引き継ぎ時は現在の応答ヘッダーをクリアし、エラーコードに合わせてステータスを付け直して新 body を send する。`err.raw`、スタック、SQL を handler の戻り値に入れない——外部にはサニタイズ済み情報だけ。

## モジュール内側のエンベロープ

グローバル `formatError` がサイト既定の形。`/admin` や公開 API サブドメインで別フィールド名（`error` / `detail` で `code` / `message` 以外）なら、対応する `Router({ mount: [formatError(...)] })` にもう一層。オニオンの内側が先に throw を捕まえ、そのプレフィックス配下は内側、他は外側。

/admin で別フィールド名のとき、Router 内にもう一層：

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

オニオンでは**内側が先に catch**：`/admin/*` は内側の形、他ルートはグローバル兜底。

## statusCodes で部分的に引き受け

`statusCodes` は**この層**の `formatError` が扱う HTTP コードを限定する（よく 400、422 など検証系だけ）。他 4xx / 5xx は外側へバブル。「検証だけ統一 JSON、業務 403 はグローバル」の分担に向く。

検証系だけここで、他は外層へ：

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

## ルートの throw との組み合わせ

ルートで `ctx.throw(status, …)` によりリクエストを終了しエラーチェーンへ：リソースなし **404**、業務検証 **400**、権限 **403** など。第二引数は文字列または `code` 付きオブジェクト。`formatError` の handler が `err` からコードと文言を取り `content` に組み込む。

```typescript
ctx.throw(404);
ctx.throw(400, 'name required');
ctx.throw(403, { code: 'FORBIDDEN' });
```

誤ってヘッダや body を書いたあと throw する場合は `formatError` に任せて丸ごと置き換え、action でエラー JSON を半分だけ組み立てない。

成功体・失敗体をさらに `{ success, data, statusCode }` で包み、外側 HTTP を 200 固定にするなら [レスポンスのエンベロープ](/ja/web/envelope)（`formatError` と併用が多い）。

## 次のステップ

- [レスポンスのエンベロープ](/ja/web/envelope)（統一外殻と HTTP 200）
- [レスポンスの制約](/ja/web/response)（ルートごとに 400/404 などを宣言）
- [アプリ入口](/ja/web/)（services / logger / language などグローバル設定）
- [WebApp.language](/ja/web/#language)（検証・エラー文言の言語）