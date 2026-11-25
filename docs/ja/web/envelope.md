---
outline: deep
---

# レスポンスのエンベロープ

成功・失敗を同じ JSON ラッパ（例：`{ success, data, statusCode }`）に揃え、外側の HTTP を **200** に固定し、実際の業務コードを body に載せたいとき、`WebApp.envelope` が flush 前に body とステータスを包む。

ルートではこれまで通り `ctx.send(201, …)` / `ctx.throw(400, …)`。ラッピングは書き出し段階で行われ、各 action で外殻を手書きする必要はない。

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— [アプリ入口](/ja/web/) 参照
  envelope: { // [!code focus:7]
    content: {
      success: envelope.success, // [!code highlight]
      statusCode: envelope.statusCode,
      data: envelope.payload,
    },
  },
  mount: [
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

設定後：

- `ctx.send(201, { id: 1 })` → HTTP **200**、body は `{ success: true, statusCode: 201, data: { id: 1 } }` のような形
- `ctx.throw(400, …)`（`formatError` と併用）→ HTTP **200**、`success: false`、`data` にエラー JSON。実際の **400** は `statusCode` スロット

クライアントは body の成否を見る。**HTTP ステータスだけでは判断しない**（リダイレクト・ボディなし応答は後述）。

## 組み込みスロット

`content` は宣言ツリー。葉は組み込みスロットか `envelope.slot`、通常オブジェクトのネストも可。`rule.string()` を直置きしない——実行時の値の出所がない。

| スロット | 実行時の意味 |
| --- | --- |
| `envelope.success` | 元ステータスが `< 400` か（業務上の成功） |
| `envelope.payload` | ラップ前のレスポンス body（json / string / null） |
| `envelope.statusCode` | ラップ前の HTTP ステータス（書き出し後の外側は依然 200） |

フィールド名を `data` / `result` / `payload` のどれにするかは任意。組み込みスロットをどのキーに掛けるかで決まる。

## カスタムスロットとネスト

バージョン・トレース ID など固定または派生値には `envelope.slot(schema, get)`：`schema` は OpenAPI 用。`get(vars, ctx)` の第一引数は `{ success, payload, statusCode }`、第二引数はリクエストコンテキスト（`WebContext` に `WebApp.Props` を足したもの。`onError` と同じ——pathname、headers、services など）。

定数だけなら第二引数を省略できる：

```typescript
envelope: {
  content: {
    meta: {
      ok: envelope.success,
      code: envelope.statusCode,
      version: envelope.slot(rule.string(), () => '1.0'), // [!code highlight]
    },
    result: envelope.payload,
  },
},
```

現在のリクエストから取るときは第二引数 `ctx` を使う：

```typescript
envelope: {
  content: {
    success: envelope.success,
    statusCode: envelope.statusCode,
    data: envelope.payload,
    path: envelope.slot(rule.string(), (_vars, ctx) => { // [!code highlight]
      return ctx.request.pathname;
    }),
  },
},
```

`get` の戻り値は `schema` の推論型に一致させる。閉じたオブジェクトに余分なフィールドがあると型エラーになる。

## formatError・response() との関係

- **[formatError](/ja/web/errors)**：`ctx.throw` を統一エラー JSON にまとめ、それが `envelope.payload` として外殻に入る。併用推奨。`formatError` なしでは既定のプレーンテキストエラーも payload に入り（JSON 文字列値になる）。
- **[response()](/ja/web/response)**：依然として「実際の」ステータスで成功/失敗 body を宣言。ラップは action の send/throw を変えず、書き出し前の外殻だけ変える。OpenAPI では成否分支が 200 のラップ schema に収束（下記）。特定ステータスだけ**ラップしない**場合は `response({ skipEnvelope: true })`（次節）。

業務コードは `send(201)`、`throw(404)` のまま。型とルート宣言を「常に 200」に書き換える必要はない。

::: tip
ラップ時、body が既に JSON 文字列で `Content-Type` が `application/json`（例：ミドルウェアで手動 `JSON.stringify`）のとき、フレームワークは先に `JSON.parse` してから `envelope.payload` に入れ、`data` がエスケープだらけのテキストになるのを防ぐ。
:::

## ラップしない場合

次の応答は**そのまま**書き出し、外殻なし・200 への強制変換もなし：

| 状況 | 理由 |
| --- | --- |
| **3xx** リダイレクト | Location などの意味を JSON 外殻にできない |
| **204 / 205 / 304** などコンテンツなし | body 自体がない |
| **SSE**（`text/event-stream`） | ストリーミング。一式を JSON にバッファできない |
| **Buffer / Stream** 体 | バイナリ・ストリームダウンロードに JSON ラップは不適 |

通常の json / string / null（明示 send しない既定 404 含む）はラップ対象。

[ETag](/ja/plugins/etag) 併用時：ラップで body が書き換わるとフレームワークは**元の ETag を削除**し、ラップ前の内容に対応したダイジェストが残らないようにする。

## ラップを明示的にスキップ

サイト全体で envelope を有効にしつつ、個別出口だけ**素の応答**（ダウンロード、レガシークライアント、HTML など）にする方法は二つ。

**業務ルートは `response({ skipEnvelope: true })` を優先**：その `statusCode` だけスキップ。他は依然ラップ。ランタイムと OpenAPI が一致。

```typescript
import { rule } from '@aomex/common';
import { response, Router } from '@aomex/web';

export const router = new Router();

router.get('/export.csv', { // [!code focus:14]
  mount: [
    response({
      statusCode: 200,
      contentType: 'text/csv',
      content: rule.string(),
      skipEnvelope: true, // [!code highlight]
    }),
    response({ statusCode: 400 }),
  ],
  action: async (ctx) => {
    ctx.send(await buildCsv());
  },
});
```

上の例：成功 200 は素の CSV。検証失敗 400 はサイト全体の外殻（`formatError` 経由で payload）。

同一路由に `response()` を複数掛け、それぞれ `skipEnvelope` を決められる——成功だけラップ、エラーは素、など。

**インフラ応答**（Swagger / Redoc ページ、素の OpenAPI JSON）は action で `ctx.response.skipEnvelope = true`：最終ステータスに関係なく今回の書き出しを無条件スキップ。業務 API は上記 `response({ skipEnvelope })` を優先し、ドキュメントにも載せやすい。

```typescript
action: async (ctx) => {
  ctx.response.skipEnvelope = true; // [!code highlight]
  ctx.send(rawOpenapiDocument);
},
```

## OpenAPI

`generateOpenapi` / Console の `openapi()` に**envelope 設定済みの同じ `WebApp`（`app`）**を渡すと、生成器は `app` のラップ設定を読む。他の `response` / `formatError` 注入のあと、ドキュメントの 2xx と 4xx·5xx·default を **HTTP 200** のラップ schema に収める（成否はよく `oneOf`、`success` を `true` / `false` で固定）。**3xx、204 などコンテンツなし**と `response({ skipEnvelope: true })` で登録したステータスは**維持**——ランタイムのスキップ規則と一致。

同一 operation に「skip の 200」とラップ対象の成否分支があると、その `200` の `application/json` で素 schema とラップ schema を `oneOf` に。他 media（`text/html` など）はそのまま。

`envelope.description` は収束後の `200` 応答の説明に載る。`mount` 配列を手で二重に渡さない。`app` を渡し忘れると契約は「201 + 素 body」、本番は「200 + 外殻」のまま。詳細は [OpenAPI の生成](/ja/openapi/)。

## 次のステップ

- [エラー形式](/ja/web/errors)：`formatError` とラップの payload
- [レスポンスの制約](/ja/web/response)：ルートで実ステータスと内側 content を宣言
- [OpenAPI の生成](/ja/openapi/)：契約のスキャン方法
- [Web アプリ入口](/ja/web/)：`WebApp` のその他必須項目