# ミドルウェア

サイト全体またはあるグループの API に「リクエスト入り口で処理し、業務のあとにも片付けできる」ロジックを載せ、下流 action が ctx に載せたフィールド（例：requestId）を使えるようにします。

ミドルウェアは 1 本の関数です。`await next()` を忘れないでください — そうして初めてリクエストが下へ進みます。`next` の前後にそれぞれロジックを書けます。

```typescript
import { middleware } from '@aomex/common';

export const withRequestId = middleware.mixin<{
  readonly requestId: string;
}>(async (ctx, next) => { // [!code highlight]
  ctx.requestId = crypto.randomUUID();
  await next();
});
```

::: warning
後続のミドルウェアと業務はすべて `await next()` に依存します。認証失敗で打ち切るときは呼ばなくてよいですが、うっかり抜けないでください。**必ず `await next()`** — さもないと下流の非同期エラーが未処理 Promise になりやすいです。
:::

`middleware.mixin<{ … }>` で ctx に足すフィールドを宣言すると、**それより後のミドルウェアと同じルートの action** で補完が効きます。ジェネリックなしでランタイムだけ代入すると、コンパイラは存在しない扱いです。

```typescript
import { logger } from '@/services/logger.service';

// action 内
async (ctx) => { // [!code highlight]
  logger.info(`请求 ${ctx.requestId}`);
  return { ok: true };
};
```

複数ミドルウェアがそれぞれ mixin したフィールドは、型上は同一 ctx にマージされます。ランタイムだけフィールドを載せ、 mixin ジェネリックを書かないと動きますが TypeScript は助けてくれず、リネーム漏れが起きやすいです。

## WebApp.mount

`WebApp.mount` はサイト全体のオニオン列です。CORS、アクセスログ、formatError、`routers(...)` が配列順に実行されます。前ほど外側で、`await next()` の前後に後続ルート全体を包めます。

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from '@/middlewares/request-id';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```

「毎リクエスト」系（CORS、全站 requestId、アクセスログ）は `WebApp.mount` / `ConsoleApp.mount` に置きます。

## Router.mount

URL グループ全体で同じロジック（統一認証、監査、prefix 配下の formatError）なら `Router({ mount })` — このファイルのパスだけに効き、WebApp で全站を包む必要はありません。

```typescript
import { Router } from '@aomex/web';

// あるリソース群はすべてログイン必須（auth はプロジェクトの Auth インスタンス）
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

一類のリソースの統一認証は Router.mount；公開 API は別 Router に分けてください（同一 Router で skip だらけにしない）。

## 単一ルートの mount

単一ルートの `mount` はその action の前だけ実行：そのルート固有の body/query、より厳しい authorize、公開 API と混在するときの例外。日常の検証は組み込み query / body / cors / auth を優先し、むやみに手書き middleware は不要です。

```typescript
import { rule } from '@aomex/common';
import { body } from '@aomex/web';

router.post('/login', { // [!code focus:11]
  mount: [
    body({ // [!code highlight]
      email: rule.email(),
      password: rule.string(),
    }),
  ],
  action: async (ctx) => {
    ctx.send({ token: '...' });
  },
});
```

## skip で特定リクエストを迂回

少数パスや環境でミドルウェア列全体を走らせたくないとき（ヘルスチェック免認証、テスト環境である層オフ）、既存ミドルウェアに `.skip(...)` をチェーン：条件が `true` ならそのまま `next()`、元ロジックは実行しない — `mount` を複製するより保守が少ないです。

**関数**（リクエストごとに動的）でも **`boolean`**（コンパイル時に固定）でも渡せます：

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// テスト環境で層ごとオフ：関数で包む必要なし
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// 一時的にある層無効（mount から外すのと同義）
someMiddleware.skip(true);
```

::: warning
`.skip()` は **Props 型を変えません**。認証を skip しても型上 `ctx.auth` は「ある」まま；action 内で未ログイン分岐は自分で。公開 API が多いなら認証チェーンに skip を並べるより**無認証 Router を分ける**方がよいです。
:::

## dependsOn で上流の型を借りる

ミドルウェア実装で**上流にある層が載っている前提**（認証、`userId` 付きミドルウェアなど）で、そのフィールドを `fn` 内で補完したいが、上流を再実行したくない — `middleware.dependsOn(upstream).web(...)` / `.mixin(...)` / `.console(...)` を使います。

`dependsOn` は **型だけ** 参加します。ランタイムでは渡したミドルウェアは呼ばれません；実行は mount 順の手前の層に依存します。

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// 上流に withUser 済み前提：ctx.userId が補完されるが withUser は再実行しない
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```

マウント時は上流を前に：

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

ファクトリ / `async` ファクトリも可（`combineServices` の遅延読み込みと同様、ここでも型だけ）。`dependsOn` はチェーン可能で、フィールドは重なります。

::: tip
`Middleware.Infer<typeof loadProfile>` は **`dependsOn` で借りた Props を含みません** — 外向きには「自分は ctx にフィールドを足していない」ように見えます。型借用は `fn`（と直後の 1 回 `.skip(ctx => …)`）内の `ctx` にだけ効きます。
:::

日常は組み込み query、body、cors、各種 auth を優先。OpenAPI / CLI ヘルプに書き込むなら [カスタムミドルウェア](/ja/advanced/middleware)。

## 次のステップ

- 検証と 400 文言：[リクエストボディ](/ja/web/body)、[クエリ文字列](/ja/web/query)
- 認証ミドルウェア：[統一 Auth](/ja/plugins/auth)
- OpenAPI / Help フック：[カスタムミドルウェア](/ja/advanced/middleware)