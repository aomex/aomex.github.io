---
outline: deep
---

# API Key 策略

给脚本、合作方或内部服务一条「带钥匙就能调」的通道。AuthApiKeyStrategy 从报头（或你配置的 query/cookie）读**裸**密钥，映射成应用身份——**不是** Bearer 那种两段式。终端用户登录请用 [Bearer](/zh/plugins/auth-bearer-strategy) 或 [JWT](/zh/plugins/auth-jwt-strategy)。

校验 x-api-key（或自定义头），通过后业务里用 ctx.auth.apiKey；开放平台可以和用户登录域拆成两个 Router 前缀。

## 安装

与 Bearer 共用 `@aomex/auth` 主包。

```bash
pnpm add @aomex/auth
```

```typescript
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
```

## 开放平台 Router

```typescript
import { Auth } from '@aomex/auth';
import { AuthApiKeyStrategy } from '@aomex/auth/api-key';
import { Router } from '@aomex/web';

const auth = new Auth({
  strategies: {
    apiKey: new AuthApiKeyStrategy({
      onLoaded: async (key) => {
        const app = await clients.verify(key);
        if (!app) {
          return false;
        }
        return { appId: app.id, scopes: app.scopes };
      },
    }),
  },
});

const openApi = new Router({
  prefix: '/open',
  mount: [auth.authenticate('apiKey')], // [!code highlight]
});

openApi.get('/usage', {
  action: async (ctx) => {
    ctx.send({ appId: ctx.auth.apiKey.data.appId });
  },
});
```

需要和用户 Bearer 并存时，策略名各管各的，挂载在不同 Router 上即可。

成功后：

```typescript
ctx.auth.apiKey // { key: string; data: T }
```

authorize('apiKey', …) 的额外参数类型，与 Bearer 一样，来自你写的 onAuthorize。没写 onAuthorize 时，一般只做「有没有合法 key」这一层。

## 多来源取 Key 与限流维度

`onLoaded` 必填：校验 key 并返回应用身份。默认只认报头 `x-api-key`；要按序尝试 header / query / cookie 时再写 `keyLoaders`。按 scope、套餐再卡一层时补 `onAuthorize`。

支持的 loader：header（报头裸值，key 名转小写匹配）、query（慎用，易进日志）、cookie。**不支持从 body 读 Key**，避免密钥落进请求体日志。生产优先 header。

```typescript
new AuthApiKeyStrategy({
  keyLoaders: [ // [!code highlight]
    { type: 'header', key: 'x-api-key' },
    { type: 'query', key: 'api_key' },
  ],
  onLoaded: async (key) => {
    return lookup(key);
  },
});
```


signature() 可用来生成随机 Key 串（签发新客户端时），用法与 Bearer 策略类似。

和 [@aomex/rate-limit](/zh/plugins/rate-limit) 搭配时，可按 key 做配额维度——通常要保证限流前已经完成认证，或你自己从 header 读 key：

```typescript
rateLimit({
  id: (ctx) => { // [!code highlight]
    return ctx.auth.apiKey?.key ?? ctx.request.ip;
  },
});
```

OpenAPI 会注入 apiKey scheme，in / name 一般取自**第一个** keyLoader。

::: warning
密钥泄露即权限泄露：库存哈希、支持轮换，别明文长期躺在库里。API Key 不是 C 端用户登录替代品，终端产品仍用 Bearer/JWT。
:::

别把用户 session 和 API Key 混在同一路由组：开放平台单独 prefix + authenticate('apiKey') 更清晰。

## 相关

- [身份认证](/zh/plugins/auth)
- [Bearer 策略](/zh/plugins/auth-bearer-strategy)
- [限流](/zh/plugins/rate-limit)