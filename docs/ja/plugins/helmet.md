---
outline: deep
---

# セキュリティヘッダー Helmet

ブラウザ向け応答に妥当なデフォルトの HTTP セキュリティヘッダー（クリックジャッキング・MIME スニッフィング対策など）を付け、よくあるフロントリスクを下げる。純 JSON API では任意。H5・管理画面・ドキュメントサイトではデフォルトで載せ、CSP は実リソースに合わせて締める。

上流の [helmet](https://github.com/helmetjs/helmet) ベース。オプションは HelmetOptions と同一。[helmet ドキュメント](https://helmetjs.github.io/)を参照。

```bash
pnpm add @aomex/helmet
```

## WebApp でデフォルト一式

引数なし `helmet()` で上流デフォルトのブラウザ向けヘッダー一式。HTML・ドキュメント・管理台があるなら `WebApp.mount` が一般的。純 JSON API は省略可。

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

[CORS](/ja/plugins/cors) と併用なら両方 routers の前。ヘッダーはリバースプロキシでも付けられるが、アプリ内の方が環境ごとの切り替えが楽。

通常の WebMiddleware。ctx の業務フィールドは変えない。ブラウザ DevTools → Network → 応答ヘッダーで X-Content-Type-Options、X-Frame-Options など（組み合わせは helmet デフォルトと子設定次第）。

## CSP と環境分岐

フロントページがあるなら、無引数の上で `contentSecurityPolicy` を締める：CDN / スクリプトドメインを allowlist。Swagger / ReDoc のインラインが動かないなら、開発やドキュメントルートで一時 `contentSecurityPolicy: false`。

本番で CSP を締める（骨格。実リソースに合わせて変更）：

```typescript
helmet({
  contentSecurityPolicy: { // [!code highlight]
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
    },
  },
});
```

ローカルは摩擦少なく、本番は締める——環境分岐が一般的：

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 環境 | 目安 |
| --- | --- |
| 本番（管理端 / H5 あり） | オン、CSP はフロント資源一覧と照合 |
| 本番（JSON のみ、HTML なし） | 任意。ゲートウェイが既にヘッダー統一なら省略可 |
| ローカル | ドキュメント / Swagger は `contentSecurityPolicy: false` 可 |

テンプレを厳しくコピーして CDN / スクリプトドメインを忘れると白画面、コンソールに CSP エラー。本番で楽のため CSP を緩めるとインライン面が広がり、締める目標と逆。Helmet は [CORS](/ja/plugins/cors) の**代替ではない**。クロスオリジンは別途。

## 次に

- クロスオリジン：[CORS](/ja/plugins/cors)
- Cookie ログインの偽造防止：[CSRF](/ja/plugins/csrf)
- 公開 API ドキュメント UI：[Swagger UI](/ja/openapi/swagger-ui)、[Redoc UI](/ja/openapi/redoc-ui)
- ミドルウェアの位置：[ミドルウェア](/ja/core/middleware)