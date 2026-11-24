---
outline: deep
---

# クロスオリジン CORS

ブラウザ上のフロントから API を合法に呼べるようにする。開発では前後端が別ポートでプリフライトが要る。本番では「どの origin を許すか」を締め、Cookie が要るときは credentials も付ける。

```bash
pnpm add @aomex/cors
```

## routers の前に載せる

`cors()` はミドルウェア段階で Access-Control-* 応答ヘッダーを書き、ブラウザがクロスオリジンで応答本体を読めるようにする。必ず `routers` の**前**に置く。サイト全体の応答（4xx/5xx 含む）にヘッダーが付く。後ろだとプリフライトは通っても、業務エラー時にフロントがエラー本体を読めない。

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
CORS を routers の**後ろ**に置くと、404 や検証 400 にヘッダーが無くなり、ブラウザが「クロスオリジン」と報告して本当の原因を隠す。
:::

ローカルで前後端が別ポートで、**Cookie を付けない**ときは、無引数の `cors()` がリクエストの Origin を反射するのでだいたい足りる。クロスオリジンで Cookie を付ける（[Session](/ja/plugins/auth-session-strategy)）なら、次節どおり origin を明示する。

cors() は通常の WebMiddleware で、ctx に新しいフィールドは載せない。業務 action はいつもどおり書けばよく、クロスオリジンは応答ヘッダーで解く。ブラウザで成功時に Access-Control-Allow-Origin が見える。Cookie 付きなら Access-Control-Allow-Credentials: true も要り、かつ **origin: '\*' は使えない**。

## Cookie ログイン：origin の明示が必須

`credentials: true`（または関数が `true` を返す）とき：

- **必須**で `origin` を明示する（具体ドメイン、ホワイトリスト配列、または具体オリジンを返す関数）
- 無引数 cors() のデフォルト反射に**頼らない**——漏れると作成時またはリクエスト時にすぐ例外
- `origin: '*'` は**禁止**（ブラウザもこの組み合わせを認めない）

フロントが `Authorization` や `x-csrf-token` も付けるなら `allowHeaders` で通す。フロントのスクリプトに `X-Request-Id` などカスタムヘッダーを読ませるなら `exposeHeaders`。

```typescript
cors({
  origin: 'https://app.example.com', // [!code highlight]
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  exposeHeaders: ['X-Request-Id'],
});
```

::: warning
credentials をオンにしたのに origin を書かない、または `*` にすると、アプリが起動しないかリクエストで例外になる——「任意 Origin の反射 + Cookie」という危険なデフォルトを意図的に止めている。
:::

Session ならさらに [CSRF](/ja/plugins/csrf) を載せ、フロントの `fetch` は `credentials: 'include'`。一連の流れは [Session ストラテジー](/ja/plugins/auth-session-strategy)。

## 複数フロントのホワイトリスト

App と管理画面でドメインが分かれるときは、`origin` に配列を渡せる。ヒットしたときだけ書き戻し、未ヒットは CORS を有効にしないのと同じ。

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

関数でリクエストごとに具体 origin を返してもよい（ホワイトリスト命中時だけ書き戻し。未ヒットは `undefined` で CORS 無効）：

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

プリフライトのキャッシュはデフォルト約 1 時間（`maxAge: 3600`）。ローカルでデバッグするときは `-1` にして毎回 OPTIONS を打ち直せる。GET/POST だけ開放するときは `allowMethods` で締める。隔離ページ / 公開ページからイントラ API へ（Chrome PNA）が要るときだけ `secureContext` / `privateNetworkAccess`。

| 環境 | 推奨 |
| --- | --- |
| ローカル（Cookie なし） | 無引数 `cors()` |
| ローカル（Session） | `origin: 'http://localhost:5173'` + `credentials: true` |
| 本番 | ドメイン明示またはホワイトリスト。資格情報オンならデフォルト反射は絶対使わない |

Web API だけ直し、ドキュメントサイト / Swagger / 管理画面の origin を忘れると、それらのドメインでプリフライトが落ちる。

## 次のステップ

- Cookie ログインの一連：[Session ストラテジー](/ja/plugins/auth-session-strategy)
- 書き込みの偽造防止：[CSRF](/ja/plugins/csrf)
- マウント順とオニオンモデル：[ミドルウェア](/ja/core/middleware)
- セキュリティ応答ヘッダー（CORS と並べることが多い）：[Helmet](/ja/plugins/helmet)
- サイト全体の観測：[HTTP アクセスログ](/ja/plugins/access-log)
