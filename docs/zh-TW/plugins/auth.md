---
outline: deep
---

# 身份認證

先分清兩件事：**這個人是誰**（認證），以及**能不能幹這件事**（授權）。`@aomex/auth` 把多套策略收進同一個 Auth 例項：驗不過身份一般是 **401**，身份有了但許可權不夠是 **403**。前端和監控都能據此判斷「去登入」還是「換賬號 / 升許可權」。

給一組業務介面加上「必須先登入」，其中少數介面還要更高角色；登入介面本身不掛鑑權，登進去之後能在 ctx.auth 裡讀到身份。

## 安裝

按實際策略裝包；還沒做登入可以先把這篇當路線圖。

```bash
pnpm add @aomex/auth
# JWT 另装：pnpm add @aomex/auth-jwt-strategy
# Session 另需：pnpm add @aomex/cache（跨域再加 @aomex/cors @aomex/csrf）
```

| 策略包 | 典型場景 |
| --- | --- |
| [`@aomex/auth/bearer`](/zh-TW/plugins/auth-bearer-strategy) | 不透明 token，服務端存會話 |
| [`@aomex/auth/session`](/zh-TW/plugins/auth-session-strategy) | 瀏覽器 Cookie 登入態；配合 CORS + CSRF |
| [`@aomex/auth/api-key`](/zh-TW/plugins/auth-api-key-strategy) | 機器對機器、開放平臺 |
| [`@aomex/auth-jwt-strategy`](/zh-TW/plugins/auth-jwt-strategy) | 自包含 JWT，少查庫 |

## Router 上掛 authenticate

`Auth` 例項裡註冊各策略（Bearer / Session / API Key / JWT）；`authenticate(name)` 返回「先驗身份」的中介軟體，掛到 Router 或單條路由。驗過以後 `ctx.auth[name]` 可讀身份；再在單條路由上 `authorize` 做細粒度許可權。

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

同一條路由要「先登入再卡許可權」時，可以鏈式寫：

```typescript
router.post('/admin/reboot', {
  mount: [auth.authenticate('bearer').authorize(99)], // [!code highlight]
  action: async (ctx) => {
    // …
  },
});
```

- ctx.auth.bearer 在掛上 authenticate('bearer') 且通過後才有意義；型別裡會帶上策略名對應的欄位。
- authorize('bearer', 10) 裡第二個引數的型別，來自你在策略裡寫的 onAuthorize 簽名（數字、許可權碼等）。
- auth.strategy('bearer').signature(...) 用在**登入 action**裡簽發 token，不要塞進鑑權中介軟體——那是另一條 API 線。

```typescript
// 登录成功后签发（示例）
const token = auth.strategy('bearer').signature('sha256', user.id);
```

## authenticate(name)

| 什麼時候用 | 掛哪兒 |
| --- | --- |
| 一整組介面都要先登入 | `Router.mount` |
| 和公開介面混在同一檔案 | 單路由 `mount`，或拆成兩個 Router |

流程上：策略驗不過 → **401**；成功則寫入 ctx.auth[name]。返回的中介軟體還帶 .authorize(...)，可繼續鏈式收緊。未登入 / token 無效用 **401**；已登入但角色不夠再用 **403**，別混在同一語義裡。

### authorize(name, ...args)

假定**已經**走過對應策略的認證。只掛 authorize、忘了先 authenticate，執行時不會像型別那樣幫你兜底——掛載順序別反。失敗一般是 **403**。

### strategy(name)

登入、重新整理令牌時在業務程式碼裡簽發憑證（Bearer 隨機串、JWT payload 等）。**登入路由不要掛 authenticate**，否則沒 token 永遠進不來。

### 掛載位置怎麼選

| 位置 | 適合 | 注意 |
| --- | --- | --- |
| `Router.mount` | 整組私有 API | 同文件別塞公開路由 |
| 單路由 `mount` | 個別公開 / 更嚴授權 | 重複多時可抽常量 |
| `WebApp.mount` | 幾乎整站私有 | 健康檢查等要另開 Router |

公開介面別硬擠進已鑑權 Router：單獨一個不帶 authenticate 的 Router，比到處 skip 好維護。

生成 OpenAPI 時，給 `generateOpenapi` 傳入與線上同一份 `app`，文件裡的 security 才會對得上真實鑑權。多策略時 `authenticate('jwt')` 等名字要與 strategies 鍵名對齊。

## 相關

- [Bearer 策略](/zh-TW/plugins/auth-bearer-strategy)
- [Session 策略](/zh-TW/plugins/auth-session-strategy)
- [API Key 策略](/zh-TW/plugins/auth-api-key-strategy)
- [JWT 策略](/zh-TW/plugins/auth-jwt-strategy)
- 協議很特殊時：[高階：自定義鑑權策略](/zh-TW/advanced/auth-strategy)