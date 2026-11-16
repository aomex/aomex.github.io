---
outline: deep
---

# レスポンス圧縮

大きな JSON やレポート系 API を、クライアントが `Accept-Encoding` を出すとき gzip / br / zstd などで圧縮し、帯域を減らす。

**本番では Nginx（または CDN）での圧縮を優先**。Node プロセスの CPU を抑え、静的リソースや TLS 終端とも組み合わせやすい。ローカル直結、リバースプロキシなし、ゲートウェイで特定エンコーディングがまだ押せないときだけ、アプリに `@aomex/compress` を載せる。小さなレスポンスや既に圧縮されたリソース（画像・動画）はスキップし、無駄な CPU を避ける。

```bash
pnpm add @aomex/compress
```

## WebApp にサイト全体でマウント

エッジが同じレスポンスを既に圧縮していないことを確認してから `compress()` を `WebApp.mount` に入れる。レスポンスは `await next()` の**後**で `Accept-Encoding` に応じて圧縮する。業務はこれまでどおり `ctx.send` でよい。action 内で gzip を判定する必要はない。

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

compress() は CompressProps を付ける。ctx.needCompress でルート単位のオン/オフができ（補完にそのフィールドが出る）。レスポンスには Content-Encoding が付く。text/event-stream などストリーム型は多くの場合スキップし、ストリーム全体をバッファしない。

## しきい値とアルゴリズム

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `threshold` | しきい値未満の body は圧縮しない（CPU 節約） | `1024` |
| `filter` | 圧縮向きでないタイプを全体でスキップ；`ctx.needCompress` で上書き可 | MIME 判定 |
| `zstd` / `br` / `gzip` / `deflate` | 特定アルゴリズムだけ使うとき他をオフ | すべて有効 |
| `ctx.needCompress` | SSE・大ファイル DL などルート単位の例外 | `filter` 次第 |

アルゴリズム優先（クライアントがすべてサポート）：**zstd → br → gzip → deflate**。

### 大きな一覧 / エクスポート

```typescript
compress({ threshold: '4kb' });
```

### SSE では圧縮を切る

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

よくある mount 順：アクセスログ / レスポンス時間 → compress → ルート（圧縮は最終 body を見る）。

| 環境 | 推奨 |
| --- | --- |
| ローカル直結 Node | `compress()` でサイズを確認可 |
| 本番に Nginx / CDN | **エッジ圧縮を優先**；アプリ層は二重圧縮防止のため載せない |
| エッジがまだ圧縮できない | アプリ内 `compress()` を検討し、ゲートウェイの同種モジュールはオフ |

::: tip
Nginx では `gzip on;`（必要なら Brotli モジュール）が一般的。アプリとゲートウェイは**どちらか一方**でよい。
:::

::: warning
ゲートウェイとアプリが同時に圧縮すると、サイズが小さくならず遅延と CPU が二重になりがち。
:::

ストリーム API（SSE など）で ctx.needCompress = false を忘れるとバッファでリアルタイム性が壊れる。[ETag](/ja/plugins/etag) と重ねるときは順序を決め打ちせず、実リクエストで 304 とサイズを確認する。

## 次のステップ

- 条件付きキャッシュ：[ETag](/ja/plugins/etag)
- 静的の事前圧縮：[静的ファイル](/ja/plugins/serve-static)
- レスポンスヘッダーの所要時間：[レスポンス時間](/ja/plugins/response-time)