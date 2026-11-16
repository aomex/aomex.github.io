---
outline: deep
---

# クロスオリジン CORS

ブラウザ上のフロントエンドから API を正当に呼び出せるようにする。開発ではフロントと API が別ポートになりプリフライトが必要なことが多い。本番では許可する origin を絞り、Cookie が要るときは credentials も設定する。

```bash
pnpm add @aomex/cors
```

## routers の前に置く

`cors()` はミドルウェア段階で Access-Control-* レスポンスヘッダーを書き、ブラウザがクロスオリジンでレスポンスボディを読めるようにする。必ず `routers` の**前**に置く。全レスポンス（4xx/5xx 含む）にヘッダーが付く。後ろに置くとプリフライトは通っても業務エラー時にフロントがエラーボディを読めない。

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS を routers の**後ろ**に置くと、404 やバリデーション 400 でヘッダーが欠けることがある。ブラウザの「クロスオリジン」エラーが本当の原因を隠す。
:::

ローカルでポートが分かれているとき、引数なしの cors() はリクエストヘッダーの Origin を反射することが多く、開発には足りる。本番ではドメインを明示する。

cors() は通常の WebMiddleware を返し、ctx に新しいフィールドは載せない。業務 action はこれまでどおり書けばよく、クロスオリジンはレスポンスヘッダーで解決する。成功時は Access-Control-Allow-Origin が見える。Cookie 付きでは Access-Control-Allow-Credentials: true も必要で、**origin: '*' は使えない**。

## Origin と認証情報を絞る

| オプション | いつ使う | デフォルト |
| --- | --- | --- |
| `origin` | 本番でフロントドメインを固定、複数フロントは関数でホワイトリスト | リクエスト `Origin` を反射 |
| `credentials` | クロスオリジンで Cookie / 認証ヘッダーを送る | — |
| `allowHeaders` | フロントが `Authorization` などカスタムヘッダーを送る | — |
| `exposeHeaders` | フロントが `X-Request-Id` などレスポンスヘッダーを読む | — |
| `maxAge` | OPTIONS の繰り返しを減らす；デバッグは `-1` でキャッシュなし | `3600` |
| `allowMethods` | GET/POST だけ開放するとき | 一般的なメソッド一式 |
| `secureContext` / `privateNetworkAccess` | 隔離ページ、公開 Web から社内 API（Chrome PNA） | `false` |

### 本番：Cookie + 単一フロント

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials: true のとき **origin: '*' は使えない**。ブラウザが拒否する。
:::

### 本番：複数フロントのホワイトリスト

```typescript
const allowlist = new Set([
  'https://app.example.com',
  'https://admin.example.com',
]);

cors({
  origin: (ctx) => { // [!code highlight]
    const origin = ctx.request.headers['origin'];
    if (origin && allowlist.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
});
```

| 環境 | 推奨 |
| --- | --- |
| ローカル | 引数なし `cors()`、またはホワイトリストに `http://localhost:5173` |
| 本番 | 任意の `Origin` を反射しない；`credentials` 時は origin を具体ドメインに |

本番でデフォルト反射のままだと任意サイト向けに API が開く。Cookie と重なるとより危険。Web API だけ直してドキュメントサイト / Swagger / 管理画面の origin を忘れると、それらのドメインでプリフライトが失敗する。

## 次のステップ

- マウント順とオニオンモデル：[ミドルウェア](/ja/core/middleware)
- セキュリティレスポンスヘッダー（CORS と並べがち）：[Helmet](/ja/plugins/helmet)
- サイト全体の可観測性：[HTTP アクセスログ](/ja/plugins/http-access-log)