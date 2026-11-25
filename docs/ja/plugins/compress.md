---
outline: deep
---

# レスポンス圧縮

大きな JSON やレポート系 API で、クライアントが `Accept-Encoding` を付けるときに gzip / br / zstd などで圧縮し、帯域を減らす。

**本番では Nginx（または CDN）での圧縮を優先**する。Node プロセスの CPU を節約でき、静的ファイルや TLS 終端と並べやすい。本機直結・反代なし、またはゲートウェイが一時的に特定エンコーディングを押せないときだけ、アプリに `@aomex/compress` を載せる。小さな応答と既に圧縮済みの資源（画像・動画）はスキップし、無駄な CPU を避ける。

```bash
pnpm add @aomex/compress
```

## WebApp にサイト全体でマウント

エッジが**同じ応答を圧縮していない**ことを確認してから、`compress()` を `WebApp.mount` に載せる。応答は `await next()` の**後**に `Accept-Encoding` で圧縮する。業務はいつもどおり `ctx.send` でよく、action で gzip を判断する必要はない。

```typescript
import { compress } from '@aomex/compress';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    compress(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

compress() は CompressProps を付ける。ctx.needCompress で単一ルートを強制オン/オフできる（補完にフィールドが出る）。応答には Content-Encoding が付く。text/event-stream などストリーム型は通常スキップし、ストリーム全体をバッファしない。

よくある mount 順：アクセスログ / 応答時間 → compress → ルート（圧縮は最終 body を見る）。アルゴリズム優先度（クライアントが全部対応するとき）：**zstd → br → gzip → deflate**。

## 大きな一覧はしきい値を上げる

デフォルトでは約 `1024` バイト未満の body は圧縮せず CPU を節約する。エクスポートや大きな一覧は `threshold` を `'4kb'` などに上げられる。数値や単位なしは byte。

```typescript
compress({ threshold: '4kb' }); // [!code highlight]
```

特定アルゴリズムだけ使うときは、ほかを `false` にする（例：`br: false`）。`filter` は Content-Type で圧縮するかを決め、単一ルートの `ctx.needCompress` で上書きできる。

## SSE では圧縮を切る

ストリーム API で圧縮を切り忘れると、バッファがリアルタイム性を壊す。action で `ctx.needCompress` を `false` にする：

```typescript
router.get('/events', {
  action: async (ctx) => {
    ctx.needCompress = false; // [!code highlight]
    ctx.send(sseStream);
  },
});
```

| 環境 | 推奨 |
| --- | --- |
| ローカル直結 Node | `compress()` を載せてサイズを観察してよい |
| 本番に Nginx / CDN あり | **エッジ圧縮を優先**。アプリ層は載せない（二重圧縮防止） |
| エッジが一時的に押せない | アプリ内 `compress()` を検討し、ゲートウェイ側の同種モジュールは切る |

::: tip
Nginx の定番は `gzip on;`（必要なら Brotli モジュール）。アプリとゲートウェイは**どちらか一方**でよい。
:::

::: warning
ゲートウェイとアプリが同時に圧縮すると、サイズが小さくならないことが多く、遅延と CPU は二重になりがち。
:::

[ETag](/ja/plugins/etag) と重ねるときは順序を思い込みで決めず、変更後に実リクエストで 304 とサイズを確認する。

## 次のステップ

- 条件付きキャッシュ：[ETag](/ja/plugins/etag)
- 静的ファイルの事前圧縮：[静的ファイル](/ja/plugins/serve-static)
- 応答ヘッダーの所要時間：[レスポンス時間](/ja/plugins/response-time)
