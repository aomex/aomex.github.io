---
outline: deep
---

# ETag

成功した GET/HEAD 応答にエンティティタグを付ける。クライアントが If-None-Match を付け、内容が変わっていなければ **304** を返し帯域を節約する。半静的な設定やバージョン情報向け。高度に個別化された一覧は通常あまり効かない。

```bash
pnpm add @aomex/etag
```

## WebApp にサイト全体でマウント

`WebApp.mount` に `etag()` を載せる。成功した GET/HEAD に自動で ETag が付く。クライアントが If-None-Match を戻し、変わっていなければ 304。業務はいつもどおり `ctx.send`。

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

業務は引き続き ctx.send(data)。一致して「新鮮」ならミドルウェアが 304 にし、body は空。

通常の WebMiddleware で、ctx に新しいフィールドは書かない。効果側：初回応答に ETag。再リクエストで If-None-Match が一致 → **304**。既に Etag ヘッダーがある、非 2xx、非 GET/HEAD のときは通常書き換えない。

::: tip
サイト全体で[応答ボディの封筒](/ja/web/envelope)をオンにしていると、封筒が body を書き換え外側を 200 にする。フレームワークは**元の ETag を外す**ので、要約が封筒前の内容に対応したまま残らない。条件付きキャッシュが要る API は、要約が封筒の後に載ることを確認するか、その出口で `skipEnvelope`。
:::

## 半静的 API

公開設定やバージョン情報など「短時間ほぼ変わらない」GET は、サイト全体に載せるだけでよい。業務はいつもどおり DB を読んで `send`：

```typescript
router.get('/api/config', {
  action: async (ctx) => {
    ctx.send(await loadPublicConfig());
  },
});
```

動的に JSON を組み、意味が同じなら 304 でよいときは弱検証をオン：`etag({ weak: true })`（デフォルトは強検証。`ReadStream` は弱検証になりがち）。「ユーザーの注文」のような高度に個別化された一覧を、サイト全体に無理に載せない。

## 静的 + 圧縮

静的ディレクトリと圧縮を並べるとき、ETag は通常前に置き、最終書き出し前の内容を要約が見るようにする（実 304 / サイズの挙動を正とする）：

```typescript
mount: [
  etag(), // [!code highlight]
  compress(),
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
],
```

ローカルで JSON のデバッグが 304 に隠されるときは、いったん外すかハードリフレッシュ。条件付きリクエストを測るときだけオン：

```typescript
mount: [
  ...(process.env.NODE_ENV === 'production' ? [etag()] : []),
  routers('./src/routers'),
],
```

| 環境 | 推奨 |
| --- | --- |
| 本番 | 静的・半静的 API はオン推奨。個別化 API はサイト全体に無理に載せない |
| ローカル | デバッグが 304 に隠されるときは外すかハードリフレッシュ |

大流量ならキャッシュを CDN に渡してもよい。アプリ内 ETag は、304 の意味を自分で制御したいときに向く。応答ごと個別化なのにサイト全体で ETag を強開すると、要約計算で CPU が無駄になる。

## 次のステップ

- 圧縮：[Compress](/ja/plugins/compress)
- 静的ディレクトリ：[静的ファイル](/ja/plugins/serve-static)
- 応答の形を縛る：[制約付きレスポンス](/ja/web/response)
