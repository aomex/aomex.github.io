---
outline: deep
---

# Bearer 策略

最常见的前端姿势是：`Authorization: Bearer <token>`。服务端拿不透明 token 去换用户对象；验不过 **401**。想本地验签、少查库可以看 [JWT 策略](/zh/plugins/auth-jwt-strategy)，但吊销和改权限通常要另做功课。

配置 AuthBearerStrategy：从请求里取出 token，在 onLoaded 里换成业务身份；需要角色时在 onAuthorize 里比大小；业务里读 ctx.auth.bearer.data，不是原始 token 串。

## 安装

Bearer 随 `@aomex/auth` 主包提供，从子路径导入即可。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded 与 Router 挂载

```typescript
import { Auth } from '@aomex/auth';
import { AuthBearerStrategy } from '@aomex/auth/bearer';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    bearer: new AuthBearerStrategy({
      onLoaded: async (token, ctx) => {
        const row = await db.tokens.find(token);
        if (!row) {
          return false;
        }
        return { userId: row.userId, role: row.role };
      },
      onAuthorize(minRole: number) {
        return this.getIdentity().role >= minRole;
      },
    }),
  },
});

const router = new Router({ // [!code focus:10]
  mount: [auth.authenticate('bearer')], // [!code highlight]
});

router.get('/me', {
  action: async (ctx) => {
    ctx.send(ctx.auth.bearer.data);
  },
});

router.delete('/posts/:id', {
  mount: [auth.authenticate('bearer').authorize(10)],
  action: async (ctx) => {
    ctx.send(204, null);
  },
});
```

登录接口（不挂 authenticate）里签发 token：

```typescript
router.post('/login', { // [!code focus:13]
  mount: [body({ email: rule.email(), password: rule.string() })],
  action: async (ctx) => {
    const user = await verifyPassword(ctx.body);
    if (!user) {
      return ctx.throw(401, 'invalid credentials');
    }

    const token = auth.strategy('bearer').signature('sha256', user.id); // [!code highlight]
    await saveSession(token, { userId: user.id, role: user.role });
    ctx.send({ token });
  },
});
```

signature 生成的是**不透明**随机串（可掺业务键做域隔离），**不是** JWT。登录路由本身不要挂 authenticate。

认证成功后：

```typescript
ctx.auth.bearer // { token: string; data: T }
```

T 是 onLoaded 在成功时返回的对象形状。authorize('bearer', n) 里 n 的类型跟着你的 onAuthorize 走。

onAuthorize 可以写实例方法（用 this.getIdentity()），也可以写成柯里化——二选一，类型会跟着策略定义走：

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders 与 onLoaded

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `onLoaded` | 查 Redis/DB 把 token 换成用户；找不到返回 `false` | **必填** |
| `tokenLoaders` | 默认只读 `Authorization`；嵌入页等才考虑 cookie/query | header Bearer（生产首选；query/body 易进访问日志与 Referer） |
| `onAuthorize` | 需要 `authorize(角色)` 时再写；只要登录态可省略 | 可选 |

tokenLoaders 常见形态：

- `{ type: 'header', key: 'authorization' }` — 只认 `Bearer <token>` 两段式；裸 token 不放这里
- { type: 'body' \| 'query' \| 'cookie', key: 'access_token' } — 无法带头时的折中

```typescript
new AuthBearerStrategy({
  tokenLoaders: [ // [!code highlight]
    { type: 'header', key: 'authorization' },
    { type: 'query', key: 'access_token' },
  ],
  onLoaded: async (token) => {
    const session = await cache.getSession(token);
    return session || false;
  },
});
```

生成 OpenAPI 时，把挂了 `auth.authenticate('bearer')` 的同一份 `WebApp` 传给 `generateOpenapi({ app })`，Bearer 安全方案才会出现在文档里。总入口见 [身份认证](/zh/plugins/auth)。

onLoaded 返回 false 即未登录（**401**），别用业务异常代替，除非你要自定义错误码。自包含 JWT 走 [JWT 策略](/zh/plugins/auth-jwt-strategy)，别把 JWT 当不透明 Bearer 串验。

## 相关

- [身份认证](/zh/plugins/auth)
- [JWT 策略](/zh/plugins/auth-jwt-strategy)
- [OpenAPI 生成](/zh/plugins/openapi)