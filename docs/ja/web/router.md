---
outline: deep
---

# インターフェースルーティング

`src/routers` をドメインごとに分割。各ファイルが Router を export し get / post で action 登録。WebApp `mount` で `routers('./src/routers')` を一括マウント。

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
アプリへマウント：

```typescript
import { routers, WebApp } from '@aomex/web';

new WebApp({
  // services、logger、language、proxyIP …
  mount: [routers('./src/routers')], // [!code highlight]
});
```
テストや機能フラグではインスタンスを直接渡し、ディレクトリスキャンしなくてよい：

```typescript
import { userRouter } from './routers/user.js';
import { postRouter } from './routers/post.js';

mount: [routers([userRouter, postRouter])],
```
単一ルート mount に query() / body() / params() / response() があると action の ctx に型がマージ。**メソッド級** mount はその API のみ。**ルート級** `Router({ mount: [...] })` はファイル内全メソッドに効く。

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
    ctx.tenant; // 类型上不存在
  },
});
```
## prefix

`Router({ prefix })` はファイル内**全**パスに固定接頭辞。毎回 `/users` を書かなくてよい。`/v1` → `/v2` やドメイン分割は構築引数1箇所。

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
最終パス = prefix + 登録 uri（余分なスラッシュは正規化）。404 調査で `router.get('/:id')` だけ見ず prefix を足したフルパスを確認。

OpenAPI のドメイン分けは `Router({ docs: { tags: ['User'] } })`。単一ルート `docs.summary` で上書き可。

## ルート級 mount

`Router({ mount: [...] })` はファイル全メソッドにミドルウェア。グループ全体ログイン、監査、query デフォルトに。各 `router.get` で繰り返すより楽。

ファイル全体ログイン・監査：

```typescript
new Router({
  prefix: '/admin',
  mount: [auth.authenticate('bearer')],
});
```
ルート級 mount はファイル内**全**メソッド。公開と要ログインを同じ Router に詰めない——公開はファイル分割かメソッド級 mount / skip。

## 単一ルート mount、docs、disabled

**メソッド級 mount** は1ルートのみ：入参検証、単一 API 認証など。ルート級と重なるときはルート級→メソッド級の順。

**disabled** は実行時**未登録**（マッチしない、action 不入り）。環境変数や機能フラグで未完成 API を切る。本番に 501 を残すより安全。

**docs** は OpenAPI 説明（`summary` 等）。`Router({ docs: { tags } })` がグループ分け。単一 docs でタイトル上書き。[response()](/ja/web/response) と一緒に契約へスキャン。

```typescript
import { rule } from '@aomex/common';
import { query, response, Router } from '@aomex/web';

router.get('/users', { // [!code focus:11]
  disabled: process.env['FEATURE_USERS'] !== '1', // [!code highlight]
  mount: [
    query({ page: rule.int().min(1).default(1) }),
    response({ statusCode: 200, content: rule.array({ id: rule.int() }) }),
  ],
  docs: { summary: '用户列表' }, // [!code highlight]
  action: async (ctx) => {
    ctx.send([]);
  },
});
```
OpenAPI メタデータは [OpenAPI プラグイン](/ja/plugins/openapi)。

単一路径パラメータ：

```typescript
router.get('/users/:id', {
  mount: [params({ id: rule.int().min(1) })], // [!code highlight]
  action: async (ctx) => {
    ctx.send({ id: ctx.params.id });
  },
});
```
`params()` なしでは `ctx.request.params` はすべて文字列。"1" と 1 が混ざりやすい。

## HTTP メソッド

各 `router.<method>(uri, { ... })` が1動詞。登録順はマッチに影響せず、静的セグメントとリテラルパスが `:param` より優先。

| メソッド | 説明 |
| --- | --- |
| `get` | `GET`；**HEAD** は同名 `GET` とマッチ共有 |
| `post` / `put` / `patch` / `delete` | 対応動詞 |
| `all` | 上記すべて |
| `customize` | 動詞配列を自分で選ぶ |

`customize` は同一パスで複数動詞（GET 検証、POST 受領など）。標準 get/post を2本登録するとルートが増え保守がつらい。サードパーティ webhook、ヘルス兼 probe でよく使う：

Webhook は customize：

```typescript
router.customize(['GET', 'POST'], '/webhook', { // [!code highlight]
  action: async (ctx) => {
    ctx.send({ ok: true });
  },
});
```
## パス記法

登録 uri で**リテラルセグメント**が `:param` より優先。`/users/count` は `/:id` に飲まれない。

| 書き方 | 意味 |
| --- | --- |
| `/users/:id` | 名前付きパラメータ `id` |
| `/users/count` と `/users/:id` 共存 | リテラル優先。`:id` が count を食わない。順序では救えない。静的なら静的で書く |

glob スキャンは Router export だけにすると「登録されない」調査が楽。

## 次のステップ

- [Web アプリケーション入口](/ja/web/)：WebApp とサイト mount
- [クエリ文字列](/ja/web/query)：GET フィルタとページング
- [パスパラメータ](/ja/web/params)、[リクエストボディ](/ja/web/body)
