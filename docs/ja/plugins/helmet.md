---
outline: deep
---

# セキュリティヘッダー Helmet

ブラウザ向け応答に、妥当な既定の HTTP セキュリティヘッダー一式を付ける（クリックジャッキングや MIME スニッフィングなど）。よくあるフロントのリスクを下げる。純粋な JSON API は任意。H5・管理画面・ドキュメントサイトがあるときはデフォルトで載せ、CSP は実資源に合わせて締めるのが定番。

上流の [helmet](https://github.com/helmetjs/helmet) に基づき、オプションは HelmetOptions と同じ。詳細は [helmet のドキュメント](https://helmetjs.github.io/)。

```bash
pnpm add @aomex/helmet
```

## WebApp でデフォルト一式

無引数の `helmet()` は上流デフォルトのブラウザ向けセキュリティヘッダー一式を付ける。HTML・ドキュメントサイト・管理画面があるときは `WebApp.mount` に入れるのが定番。純粋な JSON API は省略してよい。

```typescript
import { helmet } from '@aomex/helmet';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    helmet(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

[CORS](/ja/plugins/cors) と併用するときは、どちらも routers の前でよい。ヘッダーは反代層でも付けられるが、アプリ内なら環境ごとの切り替えがしやすい。

通常の WebMiddleware を返し、ctx の業務フィールドは変えない。ブラウザの開発者ツール → Network → 応答ヘッダーに X-Content-Type-Options、X-Frame-Options などが見える（具体の組み合わせは helmet のデフォルトと子設定による）。

## CSP と環境分岐

フロントページがあるときは、無引数一式の上で `contentSecurityPolicy` を締める。CDN / スクリプトドメインをホワイトリストに書く。Swagger / ReDoc のインラインスクリプトが動かないときは、開発やドキュメントルートで一時的に `contentSecurityPolicy: false`。

本番で CSP を締める（骨格。実資源に合わせて直す）：

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

ローカルは摩擦を減らし、本番で締める。よくある環境分岐：

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 環境 | 推奨 |
| --- | --- |
| 本番（管理画面 / H5 あり） | オン。CSP はフロント資源リストに合わせる |
| 本番（JSON のみ、HTML なし） | 任意。ゲートウェイが統一でヘッダーを付けるなら省略可 |
| ローカル | ドキュメントサイト / Swagger は `contentSecurityPolicy: false` 可 |

CSP を厳しくテンプレから写して CDN / スクリプトドメインを通し忘れると、ページが白画面になりコンソールに CSP エラーが並ぶ。本番で手間を惜しんで CSP を切るとインラインスクリプト面が広がり、本番で締める目標と逆になる。Helmet は [CORS](/ja/plugins/cors) の代わりにはならない。クロスオリジンは別途設定する。

## 次のステップ

- クロスオリジン：[CORS](/ja/plugins/cors)
- Cookie ログインの偽造防止：[CSRF](/ja/plugins/csrf)
- 公開 API ドキュメント UI：[Swagger UI](/ja/openapi/swagger-ui)、[Redoc UI](/ja/openapi/redoc-ui)
- ミドルウェアのマウント位置：[ミドルウェア](/ja/core/middleware)
