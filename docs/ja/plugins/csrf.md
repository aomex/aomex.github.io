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
  language: { mode: 'fixed', language: 'ja-JP' },
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

ミドルウェアは ctx に `csrfToken`（現在の token 文字列）を付ける。Cookie は **強制** `httpOnly: false`（ダブルサブミットは JS が読む必要がある）。ほかの属性（`sameSite` / `path` / `maxAge`）は設定可能で、デフォルトは `setCookie` と同じ（`SameSite=Strict` 含む）。

ログイン Cookie もクロスオリジンで送るなら、CORS は `credentials: true` と **明示的な** `origin`、`allowHeaders` に `x-csrf-token`。[CORS](/ja/plugins/cors) と [Session](/ja/plugins/auth-session-strategy) を参照。

## フロントの付け方

1. 任意の GET（またはページ表示）で応答に `Set-Cookie: csrfToken=...`
2. `document.cookie`（または cookie ヘルパー）で値を読む
3. 書き込みにヘッダー `x-csrf-token: <同じ値>`。ログイン Cookie も使うなら `credentials: 'include'`

```typescript
function readCsrfToken() {
  const row = document.cookie
    .split('; ')
    .find((line) => line.startsWith('csrfToken='));
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

Cookie 無しでいきなり POST すると **403**。ただし応答に新しい `Set-Cookie` が付くことがあるので、読んでリトライすればよい。

## オプションとスキップ

| オプション | いつ使うか | デフォルト |
| --- | --- | --- |
| `cookie.name` | 既存フロントの約定に合わせる | `csrfToken` |
| `cookie.sameSite` / `path` / `maxAge` / `secure` | クロスサイト、パス分離、有効期限 | `setCookie` と同じ。`httpOnly` は常に `false` |
| `headerName` | フロントが別ヘッダー名を使っている | `x-csrf-token` |
| `ignoreMethods` | 検証しないメソッド | `GET`、`HEAD`、`OPTIONS` |
| `ignore` | ヘルスチェック、外部 webhook などをリクエスト単位でスキップ | — |

```typescript
csrf({
  cookie: { sameSite: 'lax', maxAge: 86400 },
  headerName: 'x-xsrf-token',
  ignore: (ctx) => {
    return ctx.request.pathname.startsWith('/webhooks/');
  },
});
```

読むのは Header + Cookie だけ。**body は読まない**ので `body()` 解析と干渉しない。Webhook などブラウザ以外は `ignore` で通す。CSRF を全体オフにしない。

## 関連

- [Session ストラテジー](/ja/plugins/auth-session-strategy)
- [CORS](/ja/plugins/cors)
- [Helmet](/ja/plugins/helmet)
