---
outline: deep
---

# CSRF 防護

ブラウザは同一サイトの Cookie を自動で付ける。攻撃者のページがあなたのブラウザに API へ POST させると、**HttpOnly のログイン Cookie も一緒に送られる**——これがクロスサイトリクエストフォージェリ。`@aomex/csrf` は**ダブルサブミット Cookie**：サーバーが読める `csrfToken` Cookie を発行し、フロントが同じ値をリクエストヘッダーに書く。一致したときだけ書き込みを通す。

[Session](/ja/plugins/auth-session-strategy) とほぼ常にセット。Bearer ヘッダーだけ使って Cookie ログインに依存しないなら、通常 CSRF は不要。

```bash
pnpm add @aomex/csrf
```

## routers の前に載せる

無引数の `csrf()` で足りる。GET/HEAD/OPTIONS は Cookie の発行・再利用だけでヘッダー検証なし。POST など書き込みは Cookie と `x-csrf-token` の一致が必要。不一致は **403**。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    cors({ origin: 'https://app.example.com', credentials: true }),
    csrf(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

::: warning
必ず routers の**前**に。検証失敗がエラーミドルウェアに入るとき、csrf が後ろだと発行直後の `Set-Cookie` がブラウザに届かず、フロントがずっと token 欠乏になる。
:::

ミドルウェアは ctx に `csrfToken`（現在の token 文字列）を載せる。Cookie は**強制**で `httpOnly: false`（ダブルサブミットは JS から読める必要がある）。ほかの属性（`sameSite` / `path` / `maxAge`）は設定可で、デフォルトは `setCookie` と同じ（`SameSite=Strict` を含む）。

クロスオリジンでログイン Cookie も付けるときは、CORS で `credentials: true` かつ**明示的な** `origin`、さらに `allowHeaders` で `x-csrf-token` を通す。[CORS](/ja/plugins/cors) と [Session](/ja/plugins/auth-session-strategy) を参照。

## フロントの付け方

1. まず任意の GET（またはページを開く）。応答に `Set-Cookie: csrfToken=...` が付く
2. `document.cookie`（または cookie ユーティリティ）で値を読む
3. 書き込みリクエストにヘッダー `x-csrf-token: <同じ値>` を付け、ログイン Cookie も使うなら `credentials: 'include'`

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => {
      return line.startsWith('csrfToken=');
    });
  return row?.slice('csrfToken='.length);
}

await fetch('/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': readCsrfToken()!, // [!code highlight]
  },
  body: JSON.stringify({ sku: 'A1' }),
});
```

Cookie が無いエンドポイントへいきなり POST すると **403** になるが、応答に新規発行の `Set-Cookie` が付くことがある。フロントが読んでからリトライすればよい。

## フロントの慣習に合わせる

フロントがすでに `x-xsrf-token` を使う、または Cookie 名が `csrfToken` でないときは、コンストラクタ引数で揃える。`httpOnly` は引き続き強制オフ。

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` は業務 Cookie の方針に合わせる。クロスサイトのフロントでは `sameSite` を `lax` にすることが多い。

## webhook とヘルスチェックを通す

第三者コールバックやロードバランサの探活はブラウザ Cookie がなく、ダブルサブミットにも乗らない。`ignore` でパス単位にスキップする。CSRF を全体で切らない。

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

読むのは Header と Cookie だけ。**body は読まない**ので `body()` の解析と干渉しない。デフォルトで検証しないメソッドは GET / HEAD / OPTIONS。`ignoreMethods` を変える必要はほとんどない。

## 関連

- [Session ストラテジー](/ja/plugins/auth-session-strategy)
- [クロスオリジン CORS](/ja/plugins/cors)
- [セキュリティヘッダー Helmet](/ja/plugins/helmet)
