---
outline: deep
---

# JWT 策略

用「自包含」的令牌时：网关或服务本地验签，少查 Redis。吊销通常靠短 TTL、刷新令牌或黑名单；payload 别塞密码。若要服务端随时废掉任意 session，[Bearer + 存会话](/zh/plugins/auth-bearer-strategy) 往往更顺手。

装好 `@aomex/auth-jwt-strategy`，配置密钥和 onVerified；Router 挂 authenticate('jwt')，业务里读 ctx.auth.jwt（是 onVerified 的返回值，不是 { token, data } 那套）。

## 安装

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret 与 onVerified

```typescript
import { Auth } from '@aomex/auth';
import { AuthJwtStrategy } from '@aomex/auth-jwt-strategy';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    jwt: new AuthJwtStrategy({
      secret: process.env.JWT_SECRET!,
      onVerified: (payload) => { // [!code highlight]
        return {
          userId: String(payload.sub),
          roles: (payload.roles as string[]) ?? [],
        };
      },
      onAuthorize(level: number) {
        const identity = this.getIdentity();
        return identity.roles.includes('admin') || level <= 1;
      },
    }),
  },
});

export const router = new Router({
  mount: [auth.authenticate('jwt')],
});

router.get('/me', {
  mount: [auth.authorize('jwt', 1)],
  action: async (ctx) => {
    ctx.send({ userId: ctx.auth.jwt.userId });
  },
});
```

登录或刷新时在 action 里签发：

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth 形状与 Bearer 的区别

| 策略 | `ctx.auth[name]` 大致形状 |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | `onVerified` 返回的对象本身 |

因此 JWT 路由里常见写法是 ctx.auth.jwt.userId，而不是 ctx.auth.jwt.data.userId。和 Bearer 的 ctx.auth 形状别混用——迁策略时要改业务取值路径。

authorize('jwt', level) 的参数类型跟着 onAuthorize 定义走。

::: warning
别把密码等敏感字段写进 JWT payload：载荷可被解码阅读，只放标识和角色即可。
:::

## verifyOptions 与吊销

| 选项 | 什么时候用 |
| --- | --- |
| `secret` | 对称密钥；单体 / 内网常见 |
| `tokenLoaders` | 默认 `Authorization` Bearer；需要时可像 Bearer 一样加 cookie/query |
| `verifyOptions` | 收紧算法、`audience` / `issuer` |
| `onVerified` | 把 payload 收成业务身份；黑名单命中返回 `false` → 401 |
| `onAuthorize` | 管理接口按角色拦截；实例方法里用 `this.getIdentity()` |

```typescript
new AuthJwtStrategy({
  secret: process.env.JWT_SECRET!,
  verifyOptions: { algorithms: ['HS256'], audience: 'api' }, // [!code highlight]
  onVerified: (payload) => {
    if (isRevoked(payload.jti)) {
      return false;
    }
    return {
      userId: String(payload.sub),
      roles: (payload.roles as string[]) ?? [],
    };
  },
});
```

非对称密钥、旧密钥轮换等进阶配法见 [高级：自定义鉴权策略](/zh/advanced/auth-strategy)。

验签失败时先想服务器时钟是否同步。吊销没有银弹：短 expiresIn + 刷新接口是常见组合，黑名单要自己维护。

## 相关

- [身份认证](/zh/plugins/auth)
- [Bearer 策略](/zh/plugins/auth-bearer-strategy)
- [OpenAPI 生成](/zh/plugins/openapi)