# 身份认证

请求一些私有资源时，需要识别用户信息后，才能确定该请求应该返回哪部分资源。使用身份认证中间件可以自动识别身份并在上下文携带可用的身份数据。

## 安装

```bash
pnpm add @aomex/auth
```

## 使用

身份认证一般是放在需要识别用户的路由组，而不是app入口。

```typescript
// src/web.ts
import { WebApp } from '@aomex/core';
import { Auth } from '@aomex/auth';

const auth = new Auth({
  strategies: { s1: new MyStrategy1() },
});

export const router = new Router({
  mount: [auth.authenticate('s1')],
  prefix: '/users',
});
```

## 多策略

认证实例作为统一入口，可以包含多种认证策略。使用时，在路由层调用`auth.authenticate(...)`生成中间件，这样不同的路由就可以混合使用需要的认证策略。

```typescript
export const auth = new Auth({
  strategies: {
    aaa: new MyStrategy1(),
    bbb: new MyStrategy2(),
    ccc: new MyStrategy3(),
  },
});

auth.authenticate('aaa'); // 中间件
```

## 策略实例

策略里可能会包含一些特殊的方法供用户调用，则可以通过调用`auth.strategy(...)`这种形式获取实例。

```typescript
auth.strategy('aaa').someMethod();
```

## 上下文key

默认地，被认证后的身份信息会存储在`ctx`上，而key就是策略对应的key。如果想修改，则需要在生成中间件时指定

```typescript
auth.authenticate('aaa'); // ctx.aaa
auth.authenticate('aaa', { contextKey: 'zzz' }); // ctx.zzz
```
