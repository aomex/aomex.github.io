---
outline: deep
---

# HTTP ルート

`src/routers` をドメインごとに分割し、各ファイルが `Router` を export。`get` / `post` で action を登録し、`WebApp` の `mount` で `routers('./src/routers')` を一括掛け。

```typescript
// src/routers/user.ts
import { Router } from '@aomex/web';

export const router = new Router();

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bob' },
];

router.get('/users', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send(users);
  },
});

router.get('/users/count', {
  action: async (ctx) => {
    ctx.send({ count: users.length });
  },
});
```

アプリへ：

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services、logger、language、proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```

テストやフィーチャフラグではディレクトリスキャンせずインスタンスを渡せる：

```typescript
import { userRouter } from '@/routers/user';
import { postRouter } from '@/routers/post';

mount: [routers([userRouter, postRouter])],
```

単一ルートの `mount` に `query()` / `body()` / `params()` / `response()` があると、action の `ctx` に対応型がマージされる。**メソッドレベル** mount はその API のみ。**ルートレベル** `Router({ mount: [...] })` はファイル内すべてのメソッドに効く。

```typescript
router.get('/users', { // [!code focus:11]
  mount: [
    middleware.web<{ tenant: string }>(async (ctx, next) => { // [!code highlight]
      ctx.tenant = ctx.request.headers['x-tenant'] as string;
      await next();
    }),
  ],
  action: (ctx) => {
    ctx.tenant;
  },
});

router.get('/users/:id', {
  action: (ctx) => {
    ctx.tenant; // 型上存在しない
  },
});
```

## prefix

`Router({ prefix })` はファイル内**すべて**のパスに固定プレフィックスを付ける。各 `router.get` で `/users` を書き直す手間を省く。`/v1` → `/v2` やドメイン分割はコンストラクタ引数一箇所で済む。

```typescript
import { rule } from '@aomex/common';
import { params, Router } from '@aomex/web';

export const router = new Router({ prefix: '/users' }); // [!code highlight]

router.get('/', { // [!code focus:5]
  action: async (ctx) => {
    ctx.send([]);
  },
});

router.get('/:id', {
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

最終パス = prefix + 登録 uri（余分なスラッシュは正規化）。404 調査では `router.get('/:id')` だけでなく prefix を含むフルパスを見る。

OpenAPI のドメイン分けは `Router({ docs: { tags: ['User'] } })`；単一ルートの `docs.summary` で上書き可能。

## ルートレベル mount

`Router({ mount: [...] })` はファイル全体のミドルウェア：グループ全体のログイン、監査、共通 query の default など。各 `router.get` に繰り返すよりここが楽。

ファイル全体にログイン・監査：

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```

ルートレベル mount はファイル内**すべて**に効く。公開 API と要ログインを同じ Router に詰めない——公開は別ファイルかメソッドレベル mount / skip。

## メソッドレベル mount、docs、disabled

**メソッドレベル mount** は 1 本のルートのみ：入参検証（query / body / params / response）、単 API 認証など。ルートレベルと重なるときはルートレベル → メソッドレベルの順。

**disabled** はランタイムでそのルートを**登録しない**（マッチしない、action に入らない）。環境変数やフラグで未完成 API を止めるのに。本番で 501 を残すより安全。

**docs** は OpenAPI の説明（`summary` など）。`Router({ docs: { tags } })` がグループ；単一ルートの docs はタイトル・説明を上書き。[response()](/ja/web/response) と一緒に契約へスキャンされる。

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: 'ユーザー一覧' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```

OpenAPI メタデータは [OpenAPI の生成](/ja/openapi/) · [Tags](/ja/openapi/tags)。

単一パスパラメータ：

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```

`params()` なしでは `ctx.request.params` はすべて文字列で、`"1"` と `1` が混ざりやすい。

## HTTP メソッド

各 `router.<method>(uri, { ... })` が HTTP 動詞を束縛。登録順はマッチに影響せず、静的セグメントとリテラルパスは `:param` より優先。

| メソッド | 説明 |
| --- | --- |
| `get` | `GET`；**HEAD** は同名 `GET` とマッチ共有 |
| `post` / `put` / `patch` / `delete` | 対応動詞 |
| `all` | 上記すべて |
| `customize` | 動詞配列を任意指定 |

`customize` は同パスで複数動詞（GET 検証、POST 受領など）。標準 `get` / `post` を二重登録するとルートが増え保守も悪い。サードパーティ webhook、ヘルスチェック兼 probe でよく使う：

サードパーティ webhook：

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```

## パスの書き方

登録 uri では**リテラル段**が `:param` より優先。`/users/count` は `/:id` に飲まれない。命名パラメータのキーは `params()` のフィールドと一致させる。

| 書き方 | 意味 |
| --- | --- |
| `/users/:id` | 命名パラメータ `id` |
| `/users/count` と `/users/:id` 共存 | リテラル優先；`:id` は `count` を取らない。登録順に頼らず、書ける静的段は静的で |

glob スキャンでは Router export だけにすると「登録されない」原因を追いやすい。

## 次のステップ

- [Web アプリ入口](/ja/web/)：WebApp とサイト全体の mount
- [クエリ文字列](/ja/web/query)：GET のフィルタとページング
- [パスパラメータ](/ja/web/params)、[リクエストボディ](/ja/web/body)