---
outline: deep
---

# ETag

成功した GET/HEAD のレスポンスにエンティティタグを付ける。クライアントが If-None-Match を持ち内容が変わっていなければ **304** で帯域を節約。半静的な設定やバージョン情報向き。高度にパーソナライズされた一覧では効果は小さいことが多い。

```bash
pnpm add @aomex/etag
```

## WebApp にサイト全体でマウント

`WebApp.mount` に `etag()` を載せると、成功した GET/HEAD に自動で ETag が付く。クライアントが If-None-Match を返し未変更なら 304。業務はこれまでどおり `ctx.send` でよい。

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

業務は ctx.send(data) のまま。一致かつ「新鮮」ならミドルウェアが 304、body なし。

通常の WebMiddleware。ctx に新フィールドは書かない。初回レスポンスに ETag。再リクエストで If-None-Match が一致 → **304**。既に Etag ヘッダー、非 2xx、GET/HEAD 以外は多くの場合書き換えない。

::: tip
サイト全体で [レスポンスエンベロープ](/ja/web/envelope) を有効にしているとき、ラップは body を書き換え外側を 200 にする。フレームワークは**元の ETag を除去**し、ダイジェストがラップ前の内容を指したまま残らないようにする。条件付きキャッシュが必要な API では、ダイジェストがラップ後の内容に乗ることを確認するか、その出口で `skipEnvelope` を使う。
:::

## 弱検証と組み合わせ

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `weak` | 内容が意味的に同じなら 304（動的 JSON）；強検証はバイト一致 | `false`（`ReadStream` は弱検証が多い） |

```typescript
mount: [etag({ weak: true })];
```

### 半静的 API（本番でよくオン）

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

### 静的 + 圧縮

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

| 環境 | 推奨 |
| --- | --- |
| 本番 | 静的・半静的 API はオン推奨。「ユーザー注文」など個別化 API はサイト全体強制は不要なことも |
| ローカル | JSON が 304 で見えないときは一旦オフかハードリフレッシュ。条件付きリクエストの検証時にオン |

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

大流量は CDN にキャッシュを任せることも多い。アプリ内 ETag は 304 意味を自分で握りたいとき向き。

ローカルで ETag オンなのに「コードを変えてもブラウザが変わらない」ときはまず **304** を疑う。すべてのレスポンスが個別化なのにサイト全体で強 ETag だとダイジェスト計算が無駄。[Compress](/ja/plugins/compress) と重ねるときはデプロイ順を決め打ちせず、実際の 304/サイズで確認。

## 次のステップ

- 圧縮：[Compress](/ja/plugins/compress)
- 静的ディレクトリ：[静的ファイル](/ja/plugins/serve-static)
- レスポンス形の制約：[制約付きレスポンス](/ja/web/response)