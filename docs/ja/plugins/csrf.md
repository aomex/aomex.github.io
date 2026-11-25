---
outline: deep
---

# CSRF 防御

ブラウザは同サイト Cookie を自動で付ける。攻撃者のページがあなたの API へ POST を誘導すると、**HttpOnly のログイン Cookie も付いてしまう**——これがクロスサイトリクエストフォージェリ（CSRF）だ。`@aomex/csrf` は**二重送信 Cookie** を使う：サーバーが読み取り可能な `csrfToken` Cookie を発行し、フロントが同じ値をリクエストヘッダーに載せる。一致したときだけ書き込み系を通す。

[Session](/ja/plugins/auth-session-strategy) とほぼ常にセット。Bearer ヘッダーだけでログインし Cookie に依存しないなら、通常 CSRF は不要。

```bash
pnpm add @aomex/csrf
```

## routers の前に載せる

引数なし `csrf()` で足りる：GET/HEAD/OPTIONS は Cookie の発行・継続だけで、ヘッダーは検証しない。POST などの書き込みメソッドは Cookie と `x-csrf-token` が一致しないと **403**。

```typescript
import { cors } from '@aomex/cors';
import { csrf } from '@aomex/csrf';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
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
必ず routers **の前**に置く。検証失敗がエラーミドルウェア経由になるとき、csrf が後ろだと、いま発行した `Set-Cookie` がブラウザに届かず、フロントがずっと token を持てない。
:::

ミドルウェアは ctx に `csrfToken`（現在の token 文字列）を載せる。Cookie は**強制**で `httpOnly: false`（二重送信では JS から読む必要がある）。それ以外（`sameSite` / `path` / `maxAge`）は設定可。デフォルトは `setCookie` と同様（`SameSite=Strict` 含む）。

クロスオリジンでログイン Cookie も載せるなら、CORS で `credentials: true` と**明示**の `origin`、さらに `allowHeaders` で `x-csrf-token` を通す。 [CORS](/ja/plugins/cors) と [Session](/ja/plugins/auth-session-strategy) を参照。

## フロントの付け方

1. 先に任意の GET（またはページを開く）。応答に `Set-Cookie: csrfToken=...` が付く
2. `document.cookie`（または cookie ユーティリティ）で値を読む
3. 書き込みリクエストに `x-csrf-token: <同じ値>` と、`credentials: 'include'`（ログイン Cookie も使う場合）

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

Cookie なしのまま最初から POST すると **403** だが、応答には新しい `Set-Cookie` が付くことがある。フロントが読み取ってからリトライすればよい。

## フロントの約束に合わせる

フロントが `x-xsrf-token` を使う、または Cookie 名が `csrfToken` でないときは、コンストラクタ引数で揃える。`httpOnly` は引き続き強制でオフ。

```typescript
csrf({
  cookie: { name: 'XSRF-TOKEN', sameSite: 'lax', maxAge: 86400 }, // [!code highlight]
  headerName: 'x-xsrf-token',
});
```

`sameSite` / `path` / `secure` / `maxAge` は業務の Cookie 方針に合わせる。クロスサイトのフロントでは `sameSite` を `lax` にすることが多い。

## webhook とヘルスチェックを通す

サードパーティコールバックや LB のプローブにはブラウザ Cookie がなく、二重送信も不要。`ignore` でパス単位にスキップする。CSRF を全体で切らない。

```typescript
csrf({
  ignore: (ctx) => { // [!code focus:3]
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

ヘッダーと Cookie だけを見て** body は読まない**。`body()` 解析と干渉しない。デフォルトで検証しないメソッドは GET / HEAD / OPTIONS。`ignoreMethods` を変えるのは稀。

## 関連

- [Session 戦略](/ja/plugins/auth-session-strategy)
- [クロスオリジン CORS](/ja/plugins/cors)
- [セキュリティヘッダー Helmet](/ja/plugins/helmet)