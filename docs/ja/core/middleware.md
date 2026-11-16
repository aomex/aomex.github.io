# ミドルウェア

サイト全体やルートグループに「リクエスト进来時に処理し、業務完了後も後片付けできる」層を載せ、下流 action が ctx のフィールド（例 `requestId`）を使えるようにする。

ミドルウェアは関数1つ：`await next()` を忘れると下に進まない。`next` の前後にロジックを書ける。

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
後続ミドルウェアと業務は `await next()` に依存。認証失敗で切りたいなら呼ばなくてよいが、うっかり抜けると未処理 Promise に。必ず **`await next()`**。
:::

`middleware.mixin<{ … }>` で ctx に足すフィールドを宣言すると、**それより後のミドルウェアと同一ルート action** で補完が効く。ジェネリックなしで実行時だけ代入すると、TypeScript は存在しない扱い。

```typescript
// action 里
async (ctx) => { // [!code highlight]
  await services.logger.info('请求', { requestId: ctx.requestId });
  return { ok: true };
};
```
複数ミドルウェアの mixin フィールドは型上1つの ctx にマージ。実行時だけ ctx に載せ、mixin ジェネリックを書かないと動くが TS は助けてくれない。リネーム漏れが出やすい。

## WebApp.mount

`WebApp.mount` はサイト全体のオニオン列：CORS、アクセスログ、formatError、`routers(...)` が配列順。`await next()` の前後で後続ルート全体を包める。

```typescript
import { WebApp } from '@aomex/web';
import { routers } from '@aomex/web';
import { withRequestId } from './middlewares/request-id.js';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:2]
    withRequestId, // [!code highlight]
    routers('./src/routers'),
  ],
});
```
CORS、サイト全体 requestId、アクセスログなど「毎リクエスト必要」なものは `WebApp.mount` / `ConsoleApp.mount`。

## Router.mount

URL グループで同じロジック（一括認証、監査、プレフィックス配下 formatError）なら `Router({ mount })`。本ファイルのパスだけ。WebApp で全サイトを包む必要はない。

```typescript
import { Router } from '@aomex/web';

// 某一组资源都要登录（auth 为项目里配好的 Auth 实例）
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```
リソース種別ごとの認証は Router.mount。公開 API は別 Router（同じ Router で skip だらけにしない）。

## 単一ルート mount

単一ルートの `mount` はその action の前だけ。ルート固有の body/query、厳しい authorize、公開と混在する Router の例外。日常は組み込み query / body / cors / auth を優先。どこでも手書き middleware 不要。

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

一部パスや環境でミドルウェア全体を走らせたくない（ヘルスチェック認証免除、テスト環境で層 OFF）とき、既存ミドルウェアに `.skip(...)`：条件が `true` なら即 `next()`、元ロジックは実行しない——`mount` 複製より楽。

**関数**（リクエストごと）か **`boolean`**（コンパイル時に決め打ち）を渡せる：

```typescript
const authMaybe = auth.authenticate('bearer').skip((ctx) => { // [!code highlight]
  return ctx.request.pathname === '/health';
});

// 测试环境整层关掉：不必再包一层函数
const accessLogMaybe = accessLog().skip(process.env['NODE_ENV'] === 'test');

// 临时禁用某层（等价于挂 mount 时先拿掉）
someMiddleware.skip(true);
```
::: warning
`.skip()` は **Props 型を変えない**：認証を skip しても型上 `ctx.auth` は「ある」まま。action で未ログイン分岐は自分で。公開が多いなら「無認証 Router」に分ける方が、認証チェーンに skip を並べるよりよい。
:::

## dependsOn で上流の型だけ借りる

ミドルウェア実装で**上流が既に載せた層**（認証、`userId` 付きミドルウェアなど）を前提に、`fn` でそのフィールドを補完したいが上流を再実行したくない——`middleware.dependsOn(上流).web(...)` / `.mixin(...)` / `.console(...)`。

`dependsOn` は**型だけ**：実行時に渡したミドルウェアは呼ばれない。実際の実行は mount 順の前の層。

```typescript
import { middleware } from '@aomex/common';

const withUser = middleware.web<{ userId: number }>(async (ctx, next) => {
  ctx.userId = Number(ctx.request.headers['x-user-id']);
  await next();
});

// 假定上游已挂 withUser：这里能补全 ctx.userId，但不会再跑一遍 withUser
export const loadProfile = middleware.dependsOn(withUser).web(async (ctx, next) => { // [!code highlight]
  const profile = await services.user.getProfile(ctx.userId);
  ctx.send(profile);
  await next();
});
```
マウント時は上流を前に置く：

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```
ファクトリ / `async` ファクトリも可（`combineServices` の遅延読み込みに似るが、ここでも型だけ）。`dependsOn` はチェーン可。フィールドは積み上がる。

::: tip
`Middleware.Infer<typeof loadProfile>` は `dependsOn` で借りた Props を**含まない**——外向きには「ctx に足していない」見え方。型借用は `fn`（と直後の1回 `.skip(ctx => …)`）内の `ctx` だけ。
:::

日常は組み込み query、body、cors、各種 auth。OpenAPI / CLI ヘルプへ書くなら [カスタムミドルウェア](/ja/advanced/middleware)。

## 次のステップ

- 検証と 400 文言：[リクエストボディ](/ja/web/body)、[クエリ文字列](/ja/web/query)
- 認証ミドルウェア：[統一認証 Auth](/ja/plugins/auth)
- OpenAPI / Help フック：[カスタムミドルウェア](/ja/advanced/middleware)
