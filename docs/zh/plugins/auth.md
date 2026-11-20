---
outline: deep
---

# 身份认证

先分清两件事：**这个人是谁**（认证），以及**能不能干这件事**（授权）。`@aomex/auth` 把多套策略收进同一个 Auth 实例：验不过身份一般是 **401**，身份有了但权限不够是 **403**。前端和监控都能据此判断「去登录」还是「换账号 / 升权限」。

给一组业务接口加上「必须先登录」，其中少数接口还要更高角色；登录接口本身不挂鉴权，登进去之后能在 ctx.auth 里读到身份。

## 安装

按实际策略装包；还没做登录可以先把这篇当路线图。

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
# Session 另需：pnpm add @aomex/cache（跨域再加 @aomex/cors @aomex/csrf）
```

| 策略包 | 典型场景 |
| --- | --- |
| [`@aomex/auth/bearer`](/zh/plugins/auth-bearer-strategy) | 不透明 token，服务端存会话 |
| [`@aomex/auth/session`](/zh/plugins/auth-session-strategy) | 浏览器 Cookie 登录态；配合 CORS + CSRF |
| [`@aomex/auth/api-key`](/zh/plugins/auth-api-key-strategy) | 机器对机器、开放平台 |
| [`@aomex/auth-jwt-strategy`](/zh/plugins/auth-jwt-strategy) | 自包含 JWT，少查库 |

## Router 上挂 authenticate

`Auth` 实例里注册各策略（Bearer / Session / API Key / JWT）；`authenticate(name)` 返回「先验身份」的中间件，挂到 Router 或单条路由。验过以后 `ctx.auth[name]` 可读身份；再在单条路由上 `authorize` 做细粒度权限。

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token) => {
        const user = await findUserByToken(token);
        return user ?? false; // false → 401
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

export const router = new Router({ // [!code focus:10]
  prefix: '/api',
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/profile', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authorize('bearer', 10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

同一条路由要「先登录再卡权限」时，可以链式写：

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- ctx.auth.bearer 在挂上 authenticate('bearer') 且通过后才有意义；类型里会带上策略名对应的字段。
- authorize('bearer', 10) 里第二个参数的类型，来自你在策略里写的 onAuthorize 签名（数字、权限码等）。
- auth.strategy('bearer').signature(...) 用在**登录 action**里签发 token，不要塞进鉴权中间件——那是另一条 API 线。

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| 什么时候用 | 挂哪儿 |
| --- | --- |
| 一整组接口都要先登录 | `Router.mount` |
| 和公开接口混在同一文件 | 单路由 `mount`，或拆成两个 Router |

流程上：策略验不过 → **401**；成功则写入 ctx.auth[name]。返回的中间件还带 .authorize(...)，可继续链式收紧。未登录 / token 无效用 **401**；已登录但角色不够再用 **403**，别混在同一语义里。

### authorize(name, ...args)

假定**已经**走过对应策略的认证。只挂 authorize、忘了先 authenticate，运行时不会像类型那样帮你兜底——挂载顺序别反。失败一般是 **403**。

### strategy(name)

登录、刷新令牌时在业务代码里签发凭证（Bearer 随机串、JWT payload 等）。**登录路由不要挂 authenticate**，否则没 token 永远进不来。

### 挂载位置怎么选

| 位置 | 适合 | 注意 |
| --- | --- | --- |
| `Router.mount` | 整组私有 API | 同文件别塞公开路由 |
| 单路由 `mount` | 个别公开 / 更严授权 | 重复多时可抽常量 |
| `WebApp.mount` | 几乎整站私有 | 健康检查等要另开 Router |

公开接口别硬挤进已鉴权 Router：单独一个不带 authenticate 的 Router，比到处 skip 好维护。

生成 OpenAPI 时，给 `generateOpenapi` 传入与线上同一份 `app`，文档里的 security 才会对得上真实鉴权。多策略时 `authenticate('jwt')` 等名字要与 strategies 键名对齐。

## 相关

- [Bearer 策略](/zh/plugins/auth-bearer-strategy)
- [Session 策略](/zh/plugins/auth-session-strategy)
- [API Key 策略](/zh/plugins/auth-api-key-strategy)
- [JWT 策略](/zh/plugins/auth-jwt-strategy)
- 协议很特殊时：[高级：自定义鉴权策略](/zh/advanced/auth-strategy)