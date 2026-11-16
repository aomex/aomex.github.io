---
outline: deep
---

# 自定義鑑權策略

[Bearer](/zh-TW/plugins/auth-bearer-strategy)、[API Key](/zh-TW/plugins/auth-api-key-strategy)、[JWT](/zh-TW/plugins/auth-jwt-strategy) 已經覆蓋「Header 裡帶 Token / Key」的大多數介面。到本頁動手，通常是取證方式套不上現成策略，但仍希望：

- 統一走 `auth.authenticate` / `authorize`  
- 未登入 **401**、無許可權 **403**  
- 業務裡用 `ctx.auth.策略名.data`  
- OpenAPI 裡有對應的 security  

典型場景：Cookie Session、網關注入的自定義頭、mTLS 摘下的身份。若只是往 `ctx` 掛 user、不在乎 Auth 約定，普通中介軟體也能跑——但 security 與未登入分支要自己兜全。

下面用 **Cookie Session** 從頭做到掛上路由。

## 第一步：想清楚「身份長什麼樣」

先定成功登入後要塞進 `ctx.auth` 的資料，例如 `{ userId: number }`。這會成為策略類的第一個泛型引數，也是 `ctx.auth.session.data` 的型別。

第二個泛型是 `authorize` 的引數列表，例如角色名：`[string]` → 之後寫 `.authorize('admin')`。

## 第二步：實現 authenticate（取證）

從請求裡拿出憑證；沒有 / 無效就按約定返回，**不要拋未捕獲異常**（否則容易變成 500，客戶端以為服務掛了）。

```typescript
// src/auth/session.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class SessionStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const sid = ctx.request.cookies?.['sid']; // [!code highlight]
    if (!sid) {
      return false; // → 401 未登录
    }
    const user = await findBySession(sid);
    if (!user) {
      return new AuthError('session expired'); // → 401，带消息
    }
    return { userId: user.id }; // → 写入 ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` 返回值約定：

| 返回值 | 行為 |
| --- | --- |
| 身份物件 | 寫入 `ctx.auth`，繼續下游 |
| `false` | 未登入 → **401** |
| `AuthError` | 帶訊息的認證失敗 → **401** |

`authorize` 返回假或 `AuthError` → **403**。`authorize` 裡通過 `this.getIdentity()` 拿當前身份（即 authenticate 成功時的那個物件）。

## 第三步：交給 Auth，鍵名即策略名

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { SessionStrategy } from './session.strategy.js';

export const auth = new Auth({
  strategies: {
    session: new SessionStrategy(), // [!code highlight]
  },
});
```

這裡的鍵名 `session` 決定三件事：

1. `auth.authenticate('session')`  
2. `ctx.auth.session`  
3. `ctx.auth.session.data` 的形狀（來自策略泛型）

## 第四步：掛到路由上試

公開登入介面和要鑑權的介面**拆開 Router**（或給鑑權鏈 `.skip`，見 [中介軟體](/zh-TW/core/middleware)），別擠在同一組裡靠感覺繞過。

```typescript
import { Router } from '@aomex/web';
import { auth } from '../auth/index.js';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('session')], // 本组都要登录
});

router.get('/dashboard', {
  mount: [auth.authenticate('session').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.session.data.userId;
    ctx.send({ userId });
  },
});
```

也可以只在單條路由的 `mount` 上掛 `authenticate`，不必 Router 級。鏈式 `.authorize('admin')` 不改變 `data` 型別；失敗由框架回 403，action 裡一般不必再判一次角色（更細的業務許可權另說）。

用手測驗證：

1. 無 Cookie → **401**  
2. 有 Cookie、角色不夠 → **403**  
3. 通過 → action 裡 `userId` 有補全  

## 第五步：補 OpenAPI security

自寫策略預設只會帶上 401 響應（基類 `openapi()`）。若不宣告 security scheme，Swagger「Authorize」對不上你的 Cookie / 自定義頭，前端按 Bearer 生成客戶端會一直 401。

在策略裡覆蓋 `openapi()`（欄位以型別提示為準，對照 Bearer 外掛即可）：

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['sessionCookie'] ||= {
        type: 'apiKey',
        in: 'cookie',
        name: 'sid',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ sessionCookie: [] });
    },
  };
}
```

重新生成 OpenAPI 後，檢查該操作的 security 與 401 描述是否出現。

::: warning
取證方式（Cookie 名、頭名）必須和 security 描述一致，否則聯調會反覆 401。
:::

## 何時不該自寫

| 場景 | 做法 |
| --- | --- |
| 標準 Bearer / JWT / API Key | 用外掛策略 |
| Cookie、閘道器頭、自研簽名 | 自定義 `Strategy`（本頁） |
| 健康檢查、靜態頁 | 拆 Router 或 `.skip`，見 [中介軟體](/zh-TW/core/middleware) |

## JWT 非對稱與金鑰輪換（仍用外掛）

自定義策略解決的是「取證方式」；JWT 演算法 / 輪換仍優先配 [JWT 策略](/zh-TW/plugins/auth-jwt-strategy)，不必重寫一套：

```typescript
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import fs from 'node:fs';

new AuthJwtStrategy({
  publicKey: fs.readFileSync('public.pem'),
  privateKey: fs.readFileSync('private.pem'),
  verifyOptions: { algorithms: ['RS256'] }, // [!code highlight]
  legacySecretOrPublicKey: [oldSecret],
  onVerified: (payload) => {
    return payload;
  },
});
```

## 相關

- 統一入口與現成策略：[身份認證](/zh-TW/plugins/auth)
- 401 / 403 JSON：[錯誤格式](/zh-TW/web/errors)
