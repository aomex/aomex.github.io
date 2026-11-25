---
outline: deep
---

# ETag

成功した GET/HEAD 応答に実体タグを付ける。クライアントが If-None-Match を送り内容が変わっていなければ **304** で帯域を節約する。半静的な設定やバージョン情報向き。高度に個別化された一覧では効果は限定的。

```bash
pnpm add @aomex/etag
```

## WebApp 全体に載せる

`WebApp.mount` に `etag()` を置くと、成功した GET/HEAD に自動で ETag が付く。If-None-Match が一致し未変更なら 304。業務はこれまでどおり `ctx.send`。

```typescript
import { etag } from '@aomex/etag';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    etag(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

業務は引き続き ctx.send(data)。一致して「新鮮」ならミドルウェアが 304、body は空。

通常の WebMiddleware で ctx に新フィールドは書かない。効果側：初回応答に ETag。再リクエストで If-None-Match が一致 → **304**。既に Etag ヘッダー、非 2xx、非 GET/HEAD のときは原則書き換えない。

::: tip
サイト全体で [レスポンス envelope](/ja/web/envelope) を有効にしていると、envelope が body を書き換え外側を 200 にする。フレームワークは**元の ETag を外す**（ダイジェストが envelope 前の内容のままになるのを防ぐ）。条件付きキャッシュが要る出口は、ダイジェストが envelope の後に乗ることを確認するか、その出口で `skipEnvelope`。
:::

## 半静的 API

公開設定やバージョン情報のように「短時間ほぼ不変」の GET なら全体に足すだけ。業務はこれまでどおり DB を見て `send`：

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

動的 JSON で意味が等価なら 304 にしたいときは弱検証：`etag({ weak: true })`（デフォルトは強検証。`ReadStream` はよく弱検証）。「ユーザー注文」のような高度に個別化された一覧に全サイト強制は不要。

## 静的 + 圧縮

静的ディレクトリと圧縮を並べるなら、ETag は通常その前——最終的に書き出す前の内容でダイジェストを見る（実際の 304 / サイズで確認）：

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

ローカルで JSON が 304 に隠れるなら一旦外すかハードリフレッシュ。条件リクエストを試すときだけ有効化：

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

| 環境 | 目安 |
| --- | --- |
| 本番 | 静的・半静的はオン推奨。個別化 API に全サイト強制は不要 |
| ローカル | 304 でデバッグが見えないときは外すかハードリフレッシュ |

大流量は CDN に任せてもよい。アプリ内 ETag は 304 语义を自分で握りたいとき向き。毎レスポンス個別化なのに全サイト強 ETag だと CPU がダイジェストだけ消費する。

## 次に

- 圧縮：[Compress](/ja/plugins/compress)
- 静的ディレクトリ：[静的ファイル](/ja/plugins/serve-static)
- レスポンス形の制約：[レスポンス制約](/ja/web/response)