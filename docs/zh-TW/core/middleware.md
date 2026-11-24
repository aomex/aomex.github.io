# 中介軟體

給整站或某一組介面掛上「請求進來時做事、業務跑完還能收尾」的一層邏輯，並讓下游 action 能用到你掛在 ctx 上的欄位（比如 requestId）。

中介軟體就是一個函式：記得 await next()，請求才會繼續往下走；你可以在呼叫 next 前後各寫一段邏輯。

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
後面的中介軟體和業務都依賴 await next()；鑑權失敗想截斷可以不調，但別無意間漏調。務必 **await next()**，否則下游非同步錯誤容易變成未處理的 Promise。
:::

用 `middleware.mixin<{ … }>` 宣告你在 ctx 上新增的欄位後，**更靠後的中介軟體和同一條路由的 action** 裡，補全會出現這些屬性；漏寫泛型、只在執行時賦值，編譯器仍會把它們當不存在。

```typescript
// action 里
async (ctx) => { // [!code highlight]
  await services.logger.info('请求', { requestId: ctx.requestId });
  return { ok: true };
};
```

多箇中間件各自 mixin 的欄位，型別上會合併到同一條 ctx 上。只執行時給 ctx 掛欄位、不寫 mixin 泛型能跑，但 TypeScript 幫不上忙，改名時容易漏改。

## WebApp.mount

`WebApp.mount` 是整站洋蔥佇列：CORS、訪問日誌、formatError、`routers(...)` 都按陣列順序執行。越靠前越外層，能在 `await next()` 前後包住後續全部路由。

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

CORS、全站 requestId、訪問日誌等「每條請求都要」的事，放 `WebApp.mount` / `ConsoleApp.mount`。

## Router.mount

整組 URL 共享同一套邏輯（統一鑑權、審計、字首下的 formatError）時用 `Router({ mount })`，隻影響本檔案註冊的路徑，不必用 WebApp 把整站都包一層。

```typescript
import { Router } from '@aomex/web';

// 某一组资源都要登录（auth 为项目里配好的 Auth 实例）
new Router({ prefix: '/admin', mount: [auth.authenticate('bearer')] });
```

某一類資源統一鑑權用 Router.mount；公開介面請拆另一個 Router（別在同一 Router 裡到處 skip）。

## 單條路由 mount

單條路由的 `mount` 只在這條 action 前執行：本條獨有的 body/query、更嚴 authorize、或和公開介面混在同一 Router 時的例外。日常校驗優先用內建 query / body / cors / auth，不必每處都手寫 middleware。

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

## 用 skip 繞過某類請求

少數路徑或環境不想跑整條中介軟體（健康檢查免鑑權、測試環境關掉某層），在已有中介軟體上鍊式 `.skip(...)`：條件為 `true` 時直接 `next()`，不執行原邏輯——比複製一份 `mount` 少維護。

可以傳**函式**（按請求動態判斷），也可以直接傳 **`boolean`**（編譯期就能定死要不要跳）：

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
`.skip()` **不會**改 Props 型別：跳過鑑權時，`ctx.auth` 在型別上仍像「有」；action 裡要自己處理未登入分支。公開介面多時，更推薦拆「無鑑權 Router」，別給鑑權鏈掛一排 skip。
:::

## 用 dependsOn 借用上游型別

寫中介軟體時，如果**假定**前面已經掛過某層（例如鑑權、帶 `userId` 的中介軟體），希望在 `fn` 裡直接補全那些欄位，但不想把上游再執行一遍——用 `middleware.dependsOn(上游).web(...)` / `.mixin(...)` / `.console(...)`。

`dependsOn` **只參與型別**：執行時不會呼叫你傳入的中介軟體；真正執行仍靠 mount 順序裡前面那一層。

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

掛載時仍要把上游放在前面：

```typescript
router.get('/me', {
  mount: [withUser, loadProfile], // [!code highlight]
  action: async () => {},
});
```

也可以傳工廠 / `async` 工廠（和 `combineServices` 懶載入類似，這裡同樣只為型別服務）。可鏈式多次 `dependsOn`，欄位會疊在一起。

::: tip
`Middleware.Infer<typeof loadProfile>` **不會**帶上 `dependsOn` 借來的 Props——對外仍像「自己沒往 ctx 上加欄位」。借型別隻影響你在 `fn`（以及緊跟著的一次 `.skip(ctx => …)`）裡看到的 `ctx`。
:::

日常優先用現成的 query、body、cors、各類 auth；要往 OpenAPI / CLI 幫助裡寫鉤子，見 [自定義中介軟體](/zh-TW/advanced/middleware)。

## 下一步

- 校驗與 400 文案：[請求實體](/zh-TW/web/body)、[查詢字串](/zh-TW/web/query)
- 鑑權中介軟體：[統一入口 Auth](/zh-TW/plugins/auth)
- OpenAPI / Help 鉤子：[自定義中介軟體](/zh-TW/advanced/middleware)
