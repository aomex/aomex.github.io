# 请求速率限制

为了减轻服务器的压力，或者防止服务攻击，请求的频率需要被严格控制

## 安装

```bash
pnpm add @aomex/rate-limit
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { rateLimit } from '@aomex/rate-limit';

export const appChain = mdchain.web.mount(rateLimit());
```

## 参数

### store

类型：`RateLimitStore`

存储和共享请求记录。不填则代表只在当前进程使用。

如果想在集群中共享记录如下引擎：

- [@aomex/rate-limit-redis-store](https://www.npmjs.com/package/@aomex/rate-limit-redis-store) 使用redis作为存储介质

### id

类型：`(ctx: WebContext) => string | false`

请求客户端的身份识别信息，默认使用客户端的IP地址。如果返回`false`，则代表该请求不需要限速

### duration

类型：`number`<br>默认值：`3600 * 1000`

限速时间周期。单位：`ms`

### maxRequest

类型：`number`

一个客户端（根据id字段）在一个时间周期内的最大可请求数量

### errorMessage

类型：`string`

被限速（状态码：429）时响应的报错信息

### headers

相关的响应头部名称。如果传入`false`，则代表不设置

```typescript
rateLimit({
  headers: {
    remain: 'X-RateLimit-Remaining',
    reset: 'X-RateLimit-Reset',
    total: 'X-RateLimit-Limit',
  },
});
```

### allowList

类型：`(ctx: WebContext) => boolean | Promise<boolean>`

白名单，不做请求频率限制

### denyList

类型：`(ctx: WebContext) => boolean | Promise<boolean>;`

黑名单，直接抛出`403`状态码
