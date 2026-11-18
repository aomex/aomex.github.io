---
outline: deep
---

# Bearer 策略

最常見的前端姿勢是：`Authorization: Bearer <token>`。服務端拿不透明 token 去換使用者物件；驗不過 **401**。想本地驗籤、少查庫可以看 [JWT 策略](/zh-TW/plugins/auth-jwt-strategy)，但吊銷和改許可權通常要另做功課。

配置 AuthBearerStrategy：從請求裡取出 token，在 onLoaded 裡換成業務身份；需要角色時在 onAuthorize 裡比大小；業務裡讀 ctx.auth.bearer.data，不是原始 token 串。

## 安裝

Bearer 隨 `@aomex/auth` 主包提供，從子路徑匯入即可。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthBearerStrategy } from '@aomex/auth/bearer';
```

## onLoaded 與 Router 掛載

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

登入介面（不掛 authenticate）裡簽發 token：

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

signature 生成的是**不透明**隨機串（可摻業務鍵做域隔離），**不是** JWT。登入路由本身不要掛 authenticate。

認證成功後：

```typescript
ctx.auth.bearer // { token: string; data: T }
```

T 是 onLoaded 在成功時返回的物件形狀。authorize('bearer', n) 裡 n 的型別跟著你的 onAuthorize 走。

onAuthorize 可以寫例項方法（用 this.getIdentity()），也可以寫成柯里化——二選一，型別會跟著策略定義走：

```typescript
onAuthorize: (minRole: number) => {
  return (identity) => {
    return identity.role >= minRole;
  };
},
```

## tokenLoaders 與 onLoaded

| 選項 | 什麼時候用 | 預設 |
| --- | --- | --- |
| `onLoaded` | 查 Redis/DB 把 token 換成使用者；找不到返回 `false` | **必填** |
| `tokenLoaders` | 預設只讀 `Authorization`；嵌入頁等才考慮 cookie/query | header Bearer（生產首選；query/body 易進訪問日誌與 Referer） |
| `onAuthorize` | 需要 `authorize(角色)` 時再寫；只要登入態可省略 | 可選 |

tokenLoaders 常見形態：

- `{ type: 'header', key: 'authorization' }` — 只認 `Bearer <token>` 兩段式；裸 token 不放這裡
- { type: 'body' \| 'query' \| 'cookie', key: 'access_token' } — 無法帶頭時的折中

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

生成 OpenAPI 時，把掛了 `auth.authenticate('bearer')` 的同一份 `WebApp` 傳給 `generateOpenapi({ app })`，Bearer 安全方案才會出現在文件裡。總入口見 [身份認證](/zh-TW/plugins/auth)。

onLoaded 返回 false 即未登入（**401**），別用業務異常代替，除非你要自定義錯誤碼。自包含 JWT 走 [JWT 策略](/zh-TW/plugins/auth-jwt-strategy)，別把 JWT 當不透明 Bearer 串驗。

## 相關

- [身份認證](/zh-TW/plugins/auth)
- [JWT 策略](/zh-TW/plugins/auth-jwt-strategy)
- [生成OpenAPI](/zh-TW/openapi/)