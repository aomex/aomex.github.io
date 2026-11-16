---
outline: deep
---

# レスポンスエンベロープ

チームによっては**成功も失敗も同じ JSON 外殻**（例 `{ success, data, statusCode }`）にし、外側 HTTP は **200** 固定、実コードは body 内。`WebApp.envelope` が flush 前に body とステータスを宣言構造へラップする。

ルートでは今までどおり `ctx.send(201, …)` / `ctx.throw(400, …)`。ラップは flush 段階。各 action で外殻を手書きしない。

```typescript
import { rule } from '@aomex/common';
import { envelope, formatError, routers, WebApp } from '@aomex/web';

new WebApp({
  // services / logger / language / proxyIP —— 见 [应用入口](/ja/web/)
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

- `ctx.send(201, { id: 1 })` → HTTP **200**、body は `{ success: true, statusCode: 201, data: { id: 1 } }` 相当
- `ctx.throw(400, …)`（formatError と併用）→ HTTP **200**、`success: false`、`data` にエラー JSON。実 **400** は `statusCode` スロット

クライアントは body 内の成否を見る。**HTTP ステータスだけ信用しない**（リダイレクト・無内容は例外、下記）。

## 内蔵スロット

`content` は宣言ツリー。葉は内蔵スロットか `envelope.slot`、通常オブジェクトのネスト可。`rule.string()` を直置きしない——実行時の値源がない。

| スロット | 実行時の意味 |
| --- | --- |
| `envelope.success` | 元ステータスが `< 400` か（業務的成功） |
| `envelope.payload` | ラップ前 body（json / string / null） |
| `envelope.statusCode` | ラップ前 HTTP コード（書き出し後外側は依然 200） |

`data`、`result`、`payload` などキー名は任意。内蔵スロットをどのキーに付けるかで決まる。

## カスタムスロットとネスト

バージョン、トレースなど固定/派生値は `envelope.slot(schema, get)`。`schema` は OpenAPI、`get` は `{ success, payload, statusCode }` のみ読める。

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
`get` 内で ctx、services など他コンテキストに依存しない——ラップ段階では上記3つしか見えない。

## formatError、response() との関係

- **[formatError](/ja/web/errors)**：`ctx.throw` を統一エラー JSON にしてから `envelope.payload` へ。併用推奨。formatError なしだとデフォルトプレーンテキストエラーも payload に入る（JSON 文字列値になり得る）。
- **[response()](/ja/web/response)**：「真の」ステータスで成功/失敗体形状を宣言。ラップは action の send/throw の書き方は変えず、書き出し直前の外殻だけ変える。OpenAPI では成否枝が 200 下のラップ schema に収まる（下記）。

業務は `send(201)`、`throw(404)` のまま。型とルート宣言を「常に 200」に書き換える必要はない。

## ラップしない場合

次は**そのまま**書き出し。外殻なし、200 にもしない：

| 場合 | 理由 |
| --- | --- |
| **3xx** リダイレクト | Location 等を JSON 外殻にできない |
| **204 / 205 / 304** など無 body | もともと body がない |
| **SSE**（`text/event-stream`） | ストリーミング。1 JSON にバッファできない |
| **Buffer / Stream** 体 | バイナリ・ストリームダウンロード |

通常の json / string / null（明示 send なしのデフォルト 404 含む）はラップ対象。

## OpenAPI

`generateOpenapi` / Console `openapi()` に **envelope 設定済みの同じ `WebApp`（`app`）** を渡すと、ジェネレータが `app` のラップ設定を読む：他 `response` / `formatError` 注入後、ドキュメントの 2xx と 4xx·5xx·default を **HTTP 200** のラップ schema に集約（成否は `oneOf`、`success` は `true` / `false` 固定が多い）；**3xx と 204 等は保持**（実行時スキップと一致）。

`envelope.description` は集約後の `200` レスポンス説明へ。`mount` 配列を手で二重に渡さない。`app` を落とすと契約は「201 + 裸 body」、本番は「200 + 外殻」のまま。[OpenAPI 生成](/ja/plugins/openapi) 参照。

## 次のステップ

- [エラー形式](/ja/web/errors)：`formatError` と payload
- [レスポンス制約](/ja/web/response)：真のステータスと内側 content
- [OpenAPI 生成](/ja/plugins/openapi)：契約のスキャン
- [Web アプリケーション入口](/ja/web/)：`WebApp` 他必須項目
