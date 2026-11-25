---
outline: deep
---

# 静的リソース

ディスク上のディレクトリ（フロント dist、public、配布パッケージ）を HTTP ファイル応答にマップする。ミス時は next() で後続 API へ。指定した root だけを配信し、プロジェクトルートや node_modules を指さない。

```bash
pnpm add @aomex/serve-static
```

## ルートの前に置く

静的ミドルウェアは通常、業務ルート**の前**（先にファイル試行、次に API）。`root` は必須。フロント成果物やダウンロード用ディレクトリを指す。

```typescript
import { serveStatic } from '@aomex/serve-static';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    serveStatic({ root: './public' }), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

通常の WebMiddleware。ヒット時は内容を直接返す。ミス時は通過。パストラバーサル、`..`、NUL、ドットファイルは拒否（パッケージ内で検証）。ディレクトリアクセスはデフォルトで `index.html` にフォールバック（`indexFile` で変更可）。ビルド成果物に `.br` / `.gz` があるとき `useCompressedFile` がデフォルトで優先（オフ可）。

::: warning
`root: '.'` や node_modules を含むディレクトリはパス漏えいリスク。本番で誤設定の例あり。
:::

## content hash 付き chunk：長キャッシュ

content hash 付き JS/CSS chunk は長い `cacheControl` 可。`index.html` などエントリに同じ `immutable` は不向き。リリース後もユーザーが古いシェルを握り続ける。

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

デフォルト `maxAge: 0`。HTML は短キャッシュまたは `noCache`。

## URL プレフィックスとディスクが不一致

CDN / ゲートウェイが `/assets/...` を `./dist` に向けるとき、`formatPath` でプレフィックスを削ってからファイル検索：

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

深いリンクのリフレッシュは静的だけでは足りない。ミスパスは routers の後で `index.html` にフォールバック。`send` と `serveStatic` は同パッケージから export。

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

| 環境 | 目安 |
| --- | --- |
| 本番 | 大流量は静的を CDN/Nginx へ。Node はフォールバックや内網向き |
| ローカル | `serveStatic` を Vite ビルド成果物に向けるだけ |

## 次に

- 条件付きキャッシュ：[ETag](/ja/plugins/etag)
- 転送圧縮：[Compress](/ja/plugins/compress)
- Web 入口の組み立て：[アプリ入口](/ja/web/)