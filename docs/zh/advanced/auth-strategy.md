---
outline: deep
---

# 自定义鉴权策略

[Bearer](/zh/plugins/auth-bearer-strategy)、[API Key](/zh/plugins/auth-api-key-strategy)、[JWT](/zh/plugins/auth-jwt-strategy)、[Session](/zh/plugins/auth-session-strategy) 已经覆盖常见取证方式。到本页动手，通常是套不上现成策略，但仍希望：

- 统一走 `auth.authenticate` / `authorize`  
- 未登录 **401**、无权限 **403**  
- 业务里用 `ctx.auth.策略名.data`  
- OpenAPI 里有对应的 security  

典型场景：网关注入的自定义头、mTLS 摘下的身份、自研签名。Cookie Session 请直接用 [Session 策略](/zh/plugins/auth-session-strategy)，不必在本页重写。若只是往 `ctx` 挂 user、不在乎 Auth 约定，普通中间件也能跑——但 security 与未登录分支要自己兜全。

下面用 **网关头**（如 `x-user-id`）从头做到挂上路由。

## 第一步：想清楚「身份长什么样」

先定成功取证后要塞进 `ctx.auth` 的数据，例如 `{ userId: number }`。这会成为策略类的第一个泛型参数，也是 `ctx.auth.gateway.data` 的类型。

第二个泛型是 `authorize` 的参数列表，例如角色名：`[string]` → 之后写 `.authorize('admin')`。

## 第二步：实现 authenticate（取证）

从请求里拿出凭证；没有 / 无效就按约定返回，**不要抛未捕获异常**（否则容易变成 500，客户端以为服务挂了）。

```typescript
// src/auth/gateway.strategy.ts
import { Strategy, AuthError } from '@aomex/auth';
import type { WebContext } from '@aomex/web';

export class GatewayStrategy extends Strategy<{ userId: number }, [string]> {
  protected async authenticate(ctx: WebContext) {
    const raw = ctx.request.get('x-user-id'); // [!code highlight]
    if (!raw) {
      return false; // → 401 未登录
    }
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return new AuthError('invalid gateway user'); // → 401，带消息
    }
    return { userId }; // → 写入 ctx.auth
  }

  protected async authorize(role: string) {
    const identity = this.getIdentity();
    return userHasRole(identity.userId, role);
  }
}
```

`authenticate` 返回值约定：

| 返回值 | 行为 |
| --- | --- |
| 身份对象 | 写入 `ctx.auth`，继续下游 |
| `false` | 未登录 → **401** |
| `AuthError` | 带消息的认证失败 → **401** |

`authorize` 返回假或 `AuthError` → **403**。`authorize` 里通过 `this.getIdentity()` 拿当前身份（即 authenticate 成功时的那个对象）。

## 第三步：交给 Auth，键名即策略名

```typescript
// src/auth/index.ts
import { Auth } from '@aomex/auth';
import { GatewayStrategy } from './gateway.strategy';

export const auth = new Auth({
  strategies: {
    gateway: new GatewayStrategy(), // [!code highlight]
  },
});
```

这里的键名 `gateway` 决定三件事：

1. `auth.authenticate('gateway')`  
2. `ctx.auth.gateway`  
3. `ctx.auth.gateway.data` 的形状（来自策略泛型）

## 第四步：挂到路由上试

公开接口和要鉴权的接口**拆开 Router**（或给鉴权链 `.skip`，见 [中间件](/zh/core/middleware)），别挤在同一组里靠感觉绕过。

```typescript
import { Router } from '@aomex/web';
import { auth } from '@/auth';

export const router = new Router({
  prefix: '/admin',
  mount: [auth.authenticate('gateway')], // 本组都要登录
});

router.get('/dashboard', {
  mount: [auth.authenticate('gateway').authorize('admin')], // [!code highlight]
  action: async (ctx) => {
    const userId = ctx.auth.gateway.data.userId;
    ctx.send({ userId });
  },
});
```

也可以只在单条路由的 `mount` 上挂 `authenticate`，不必 Router 级。链式 `.authorize('admin')` 不改变 `data` 类型；失败由框架回 403，action 里一般不必再判一次角色（更细的业务权限另说）。

用手测验证：

1. 无 `x-user-id` → **401**  
2. 有头、角色不够 → **403**  
3. 通过 → action 里 `userId` 有补全  

## 第五步：补 OpenAPI security

自写策略默认只会带上 401 响应（基类 `openapi()`）。若不声明 security scheme，Swagger「Authorize」对不上你的自定义头，前端按 Bearer 生成客户端会一直 401。

在策略里覆盖 `openapi()`（字段以类型提示为准，对照 Bearer 插件即可）：

```typescript
import type { OpenApiInjector } from '@aomex/web';

protected override openapi(): OpenApiInjector {
  return {
    ...super.openapi(),
    onDocument(document) {
      document.components ||= {};
      document.components.securitySchemes ||= {};
      document.components.securitySchemes['gatewayUser'] ||= {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
      };
    },
    onMethod(methodItem) {
      methodItem.security ||= [];
      methodItem.security.push({ gatewayUser: [] });
    },
  };
}
```

重新生成 OpenAPI 后，检查该操作的 security 与 401 描述是否出现。

::: warning
取证方式（头名、Cookie 名）必须和 security 描述一致，否则联调会反复 401。
:::

## 何时不该自写

| 场景 | 做法 |
| --- | --- |
| 标准 Bearer / JWT / API Key / Session | 用插件策略 |
| 网关头、mTLS、自研签名 | 自定义 `Strategy`（本页） |
| 健康检查、静态页 | 拆 Router 或 `.skip`，见 [中间件](/zh/core/middleware) |

## JWT 非对称与密钥轮换（仍用插件）

自定义策略解决的是「取证方式」；JWT 算法 / 轮换仍优先配 [JWT 策略](/zh/plugins/auth-jwt-strategy)，不必重写一套：

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

## 相关

- 统一入口与现成策略：[身份认证](/zh/plugins/auth)
- Cookie Session：[Session 策略](/zh/plugins/auth-session-strategy)
- 401 / 403 JSON：[错误格式](/zh/web/errors)
