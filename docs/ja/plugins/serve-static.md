---
outline: deep
---

# 静的ファイル

ディスク上のディレクトリ（フロントの dist、public、ダウンロード用パッケージ）を HTTP ファイル応答にマップする。未ヒットなら next() で後続 API に渡す。指定した root だけを出す。プロジェクトルートや node_modules を指さない。

```bash
pnpm add @aomex/serve-static
```

## ルートの前に置く

静的ミドルウェアは通常、業務ルートの**前**に置く（先にファイルを試し、次に API）。`root` は必須で、フロント成果物やダウンロード用ディレクトリを指す。

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

通常の WebMiddleware。ファイルにヒットしたら内容を送り、未ヒットなら通す。パストラバーサル、`..`、NUL、ドットファイルなどは直接拒否する（安全チェックはパッケージ内）。ディレクトリアクセス時はデフォルトで `index.html` にフォールバック（`indexFile` で変更可）。ビルドが隣に `.br` / `.gz` を出しているとき、`useCompressedFile` はデフォルトで優先する（オフ可）。

::: warning
root: '.' や node_modules を含むディレクトリを指すとパス漏洩のリスクがある。本番で誤設定の例がある。
:::

## ハッシュ付き chunk：長キャッシュ

content hash 付きの JS/CSS chunk は長い `cacheControl` を付けてよい。`index.html` などの入口に同じ `immutable` は向かない。さもないとリリース後もユーザーが古い殻のままになる。

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

デフォルトは `maxAge: 0`。HTML は短いキャッシュか `noCache` がよい。

## URL プレフィックスとディスクが一致しない

CDN / ゲートウェイが `/assets/...` を `./dist` に向けるときは、`formatPath` でプレフィックスを外してからファイルを探す：

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

## API + SPA フォールバック

深いリンクのリフレッシュは静的ミドルウェアだけでは足りない。未ヒットパスは routers の後で `index.html` に落とす。`send` と `serveStatic` は同じパッケージからエクスポートされる。

```typescript
import { middleware } from '@aomex/common';
import { send, serveStatic } from '@aomex/serve-static';

mount: [
  serveStatic({ root: './dist' }),
  routers('./src/routers'),
  middleware.web(async (ctx) => {
    const ok = await send(ctx, {
      root: './dist',
      formatPath: () => { // [!code highlight]
        return '/index.html';
      },
    });
    if (!ok) {
      ctx.throw(404);
    }
  }),
];
```

| 環境 | 推奨 |
| --- | --- |
| 本番 | 大流量なら静的は CDN/Nginx に任せることが多い。Node はフォールバックやイントラ向けに向く |
| ローカル | Vite のビルド成果物にそのまま `serveStatic` を向ければよい |

## 次のステップ

- 条件付きキャッシュ：[ETag](/ja/plugins/etag)
- 転送圧縮：[Compress](/ja/plugins/compress)
- Web 入口の組み立て：[アプリ入口](/ja/web/)
