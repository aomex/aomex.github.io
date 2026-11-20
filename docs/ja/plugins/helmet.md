---
outline: deep
---

# セキュリティヘッダー Helmet

ブラウザ向けレスポンスに、クリックジャッキングや MIME スニッフィングなど一般的なリスクを下げる既定の HTTP セキュリティヘッダーを付ける。純 JSON API は任意。H5・管理画面・ドキュメントサイトがあるときはデフォルトで載せ、CSP は実リソースに合わせて絞るのが一般的。

上流 [helmet](https://github.com/helmetjs/helmet) ベース。オプションは HelmetOptions と一致。詳細は [helmet ドキュメント](https://helmetjs.github.io/)。

```bash
pnpm add @aomex/helmet
```

## WebApp でデフォルト一式

引数なし `helmet()` で上流デフォルトのブラウザ向けヘッダー一式を付ける。HTML・ドキュメントサイト・管理台があるときは `WebApp.mount` に入れるのが一般的。純 JSON API は必要に応じて省略。

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

[CORS](/ja/plugins/cors) と併用するときは両方 routers の前でよい。ヘッダーはリバースプロキシ層でも付けられるが、アプリ内の方が環境ごとの切り替えが楽。

通常の WebMiddleware を返し、ctx の業務フィールドは変えない。ブラウザ開発者ツール → Network → レスポンスヘッダーで X-Content-Type-Options、X-Frame-Options など（helmet デフォルトと子設定次第）。

## CSP と環境分岐

| 能力 | いつ使う | 経験上の既定 |
| --- | --- | --- |
| 引数なし一式 | 本番 Web / ブラウザが叩く API | 一般的な防御をオン |
| `contentSecurityPolicy` | フロントページあり、XSS 対策 | CDN・スクリプトドメインのホワイトリスト |
| `contentSecurityPolicy: false` | Swagger/ReDoc のインラインスクリプトが動かない | 開発やドキュメントルートでよく使う |
| `NODE_ENV` で分岐 | ローカルは摩擦少なく、本番は絞る | 下の demo 参照 |

### 本番：CSP を絞る（骨格例）

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

### 開発 vs 本番

```typescript
const security =
  process.env.NODE_ENV === 'production'
    ? helmet()
    : helmet({ contentSecurityPolicy: false }); // [!code highlight]

mount: [security, cors(), routers('./src/routers')];
```

| 環境 | 推奨 |
| --- | --- |
| 本番（管理画面 / H5 あり） | オン、CSP はフロント資産リストと突合 |
| 本番（JSON のみ、HTML なし） | 任意；ゲートウェイでヘッダー統一済みなら省略可 |
| ローカル | ドキュメントサイト / Swagger で `contentSecurityPolicy: false` 可 |

CSP を厳しめのテンプレから写して CDN / スクリプトドメインを忘れると白画面、コンソールに CSP エラーが並ぶ。本番で手抜きして CSP をオフにするとインラインスクリプト面が広がり、本番締めの目的と逆。Helmet は [CORS](/ja/plugins/cors) の**代替ではない**。クロスオリジンは別途設定。

## 次のステップ

- クロスオリジン：[CORS](/ja/plugins/cors)
- Cookie ログインの偽造防止：[CSRF](/ja/plugins/csrf)
- 公開 API ドキュメント UI：[Swagger UI](/ja/openapi/swagger-ui)、[Redoc UI](/ja/openapi/redoc-ui)
- ミドルウェアの位置：[ミドルウェア](/ja/core/middleware)