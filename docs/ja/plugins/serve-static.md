---
outline: deep
---

# 静的ファイル

ディスク上のディレクトリ（フロント dist、public、ダウンロード）を HTTP ファイル応答にマップ。未ヒット時 next() で後続 API へ。**指定した root だけ**を配信。プロジェクトルートや node_modules を指さない。

```bash
pnpm add @aomex/serve-static
```

## ルートの前に

静的ミドルウェアは業務ルート**の前**（先にファイル試行、次 API）。

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

通常 WebMiddleware。ヒットで内容送出。未ヒットで通過。パストラバーサル、..、NUL、ドットファイル等は拒否（パッケージ内安全検証）。

## root とキャッシュ

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `root` | フロント成果物または DL ディレクトリ | **必須** |
| `formatPath` | URL プレフィックスとディスク不一致（例 `/assets`） | — |
| `indexFile` | ディレクトリアクセスで index にフォールバック | `index.html` |
| `useCompressedFile` | ビルド済み .br/.gz サイドカー | `true` |
| `cacheControl` | ハッシュ付き資産は長キャッシュ。HTML は短くまたは `noCache` | `maxAge: 0` |

### 長キャッシュ（ハッシュ付き chunk）

```typescript
serveStatic({
  root: './dist',
  cacheControl: { // [!code highlight]
    maxAge: 86_400_000,
    immutable: true,
  },
});
```

### URL プレフィックス書き換え

```typescript
serveStatic({
  root: './dist',
  formatPath: (pathname) => { // [!code highlight]
    const trimmed = pathname.replace(/^\/assets/, '');
    return trimmed || '/';
  },
});
```

### API + SPA フォールバック（深いリンクを index.html へ）

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
| 本番 | 大流量は CDN/Nginx に静的。Node はフォールバックや社内向き |
| ローカル | `serveStatic` を Vite ビルド出力へ直接 |

::: warning
root: '.' や node_modules を含むディレクトリはパス漏洩リスク。本番誤設定事例あり。

:::

index.html 等入口をハッシュ付き chunk と同じ immutable 長キャッシュにしない。デプロイ後も古いシェル。SPA 深いリンクは静的だけでは不足。未ヒットパスは routers の後 index.html へ（上記 demo）。

## 次のステップ

- 条件付きキャッシュ：[ETag](/ja/plugins/etag)
- 転送圧縮：[Compress](/ja/plugins/compress)
- Web 入口組み立て：[アプリ入口](/ja/web/)