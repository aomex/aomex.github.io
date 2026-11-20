---
outline: deep
---

# クロスオリジン CORS

ブラウザ上のフロントから API を正当に呼べるようにする。開発ではポートが分かれてプリフライトが要ることが多く、本番では許可する origin を絞り、Cookie が要るときは credentials も設定する。

```bash
pnpm add @aomex/cors
```

## routers の前に載せる

`cors()` はミドルウェア段階で Access-Control-* 応答ヘッダーを書き、ブラウザがクロスオリジンで本文を読めるようにする。必ず `routers` の**前**に置く。全応答（4xx/5xx 含む）にヘッダーが付く。後ろだとプリフライトは通っても業務エラー時にフロントがエラー本文を読めない。

```typescript
import { cors } from '@aomex/cors';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'ja-JP' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    cors(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
CORS を routers の**後**に置くと、404 や検証 400 でヘッダーが欠けることがある。ブラウザの「CORS エラー」が本当の原因を隠す。
:::

ローカルでポートが分かれ、**かつ Cookie を送らない**ときは、無引数 cors() がリクエスト Origin を反射し、だいたい足りる。クロスオリジンで Cookie を送る（[Session](/ja/plugins/auth-session-strategy)）なら、次節のとおり origin を明示する。

cors() は通常の WebMiddleware で、ctx に新しいフィールドは付けない。業務 action はそのまま。成功時は Access-Control-Allow-Origin が見える。Cookie 付きでは Access-Control-Allow-Credentials: true も必要で、**origin: '*' は使えない**。

## Origin と資格情報を絞る

| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `origin` | 本番でフロントドメイン固定、またはホワイトリスト / 関数 | 資格情報オフ時はリクエスト `Origin` を反射。**オン時は必須** |
| `credentials` | クロスオリジンで Cookie / クライアント証明書など | `false` |
| `allowHeaders` | `Authorization`、`x-csrf-token` など | — |
| `exposeHeaders` | フロントが `X-Request-Id` などを読む | — |
| `maxAge` | OPTIONS の繰り返しを減らす。デバッグは `-1` でキャッシュなし | `3600` |
| `allowMethods` | GET/POST だけに絞る | よく使う動詞一式 |
| `secureContext` / `privateNetworkAccess` | 隔離ページ、公開サイトから内網 API（Chrome PNA） | `false` |

### Cookie ログイン：origin の明示が必須

`credentials: true`（または関数が `true` を返す）とき：

- **必須**：`origin` を明示（具体ドメイン、ホワイトリスト配列、具体オリジンを返す関数）
- **禁止**：無引数 cors() のデフォルト反射——漏れると作成時またはリクエスト時に例外
- **禁止**：`origin: '*'`（ブラウザもこの組み合わせを認めない）

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials を付けて origin を書かない、または `*` にすると、起動できないかリクエストで例外になる。「任意 Origin 反射 + Cookie」の危険なデフォルトを意図的に止めている。
:::

Session では [CSRF](/ja/plugins/csrf) も載せ、フロントの `fetch` は `credentials: 'include'`。一連の流れは [Session ストラテジー](/ja/plugins/auth-session-strategy)。

### 複数フロントのホワイトリスト

```typescript
const allowlist = [
  'https://app.example.com',
  'https://admin.example.com',
];

cors({
  origin: allowlist, // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'x-csrf-token'],
});
```

関数でリクエストごとに具体 origin を返してもよい（ホワイトリスト命中時のみ。未命中は `undefined` で CORS 無効）：

```typescript
cors({
  origin: (ctx) => {
    const origin = ctx.request.headers['origin'];
    if (typeof origin === 'string' && allowlist.includes(origin)) {
      return origin;
    }
    return undefined;
  },
  credentials: true,
});
```

| 環境 | 推奨 |
| --- | --- |
| ローカル（Cookie なし） | 無引数 `cors()` |
| ローカル（Session） | `origin: 'http://localhost:5173'` + `credentials: true` |
| 本番 | 明示ドメインまたはホワイトリスト。資格情報オン時はデフォルト反射を使わない |

Web API だけ直し、ドキュメントサイト / Swagger / 管理画面の origin を忘れると、それらのドメインでプリフライトが失敗する。

## 次のステップ

- Cookie ログインの一連：[Session ストラテジー](/ja/plugins/auth-session-strategy)
- 書き込みの偽造防止：[CSRF](/ja/plugins/csrf)
- マウント順とオニオンモデル：[ミドルウェア](/ja/core/middleware)
- セキュリティ応答ヘッダー（CORS と並べることが多い）：[Helmet](/ja/plugins/helmet)
- サイト全体の観測：[HTTP アクセスログ](/ja/plugins/http-access-log)
