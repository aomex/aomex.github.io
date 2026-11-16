---
outline: deep
---

# JWT 策略

用「自包含」的令牌時：閘道器或服務本地驗籤，少查 Redis。吊銷通常靠短 TTL、重新整理令牌或黑名單；payload 別塞密碼。若要服務端隨時廢掉任意 session，[Bearer + 存會話](/zh-TW/plugins/auth-bearer-strategy) 往往更順手。

裝好 `@aomex/auth-jwt-strategy`，配置金鑰和 onVerified；Router 掛 authenticate('jwt')，業務裡讀 ctx.auth.jwt（是 onVerified 的返回值，不是 { token, data } 那套）。

## 安裝

```bash
pnpm add @aomex/auth
pnpm add @aomex/auth-jwt-strategy
```

## secret 與 onVerified

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

登入或重新整理時在 action 裡簽發：

```typescript
const token = auth.strategy('jwt').signature(
  { sub: user.id, roles: user.roles },
  { expiresIn: '7d' },
);
```

## ctx.auth 形狀與 Bearer 的區別

| 策略 | `ctx.auth[name]` 大致形狀 |
| --- | --- |
| Bearer | `{ token, data }` |
| JWT | `onVerified` 返回的物件本身 |

因此 JWT 路由裡常見寫法是 ctx.auth.jwt.userId，而不是 ctx.auth.jwt.data.userId。和 Bearer 的 ctx.auth 形狀別混用——遷策略時要改業務取值路徑。

authorize('jwt', level) 的引數型別跟著 onAuthorize 定義走。

::: warning
別把密碼等敏感欄位寫進 JWT payload：載荷可被解碼閱讀，只放標識和角色即可。
:::

## verifyOptions 與吊銷

| 選項 | 什麼時候用 |
| --- | --- |
| `secret` | 對稱金鑰；單體 / 內網常見 |
| `tokenLoaders` | 預設 `Authorization` Bearer；需要時可像 Bearer 一樣加 cookie/query |
| `verifyOptions` | 收緊演算法、`audience` / `issuer` |
| `onVerified` | 把 payload 收成業務身份；黑名單命中返回 `false` → 401 |
| `onAuthorize` | 管理介面按角色攔截；例項方法裡用 `this.getIdentity()` |

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

非對稱金鑰、舊金鑰輪換等進階配法見 [高階：自定義鑑權策略](/zh-TW/advanced/auth-strategy)。

驗籤失敗時先想伺服器時鐘是否同步。吊銷沒有銀彈：短 expiresIn + 重新整理介面是常見組合，黑名單要自己維護。

## 相關

- [身份認證](/zh-TW/plugins/auth)
- [Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)
- [OpenAPI 生成](/zh-TW/plugins/openapi)