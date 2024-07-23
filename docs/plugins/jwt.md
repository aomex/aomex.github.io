# JWT授权

服务器无状态令牌(JSON web token)

## 安装

```bash
pnpm add @aomex/jwt
```

## 初始化

```typescript
// src/middleware/jwt.md.ts
import { JWT } from '@aomex/jwt';

export const jwt = new JWT<{ userId: number }>();
```

### secret

类型：`Secret`

密码，用于生成令牌和验证令牌

### publicKey + privateKey

使用非对称加密代替密码，可以有效地防止泄漏。

- `publicKey` 公钥，用于验证令牌
- `privateKey` 密钥，用于生成令牌

### tokenLoader

类型：`Function | Function[]`

自定义获取令牌的逻辑。<br>
优先从自定义渠道获取令牌，如果获取失败，则继续从内置的渠道获取。内置获取渠道分别是：

- header，格式：Authorization: Bearer xxxxxx
- cookie，需指定cookie名称
- querystring，需指定参数名称

### tokenFromCookie

类型：`string`

允许令牌从cookie中的某个key获取

### tokenFromQueryString

类型：`string`

允许令牌从查询字符串的某个key获取

### verifyOptions

类型：`object`

验证令牌时的额外参数。需要和生成令牌时保持一致

### isRevoked

类型：`Function`

检测token是否已经被销毁

### legacySecretOrPublicKey

类型：`Secret[]`

更换密码或者密钥后，为了能验证旧的JWT令牌，请提供旧的密码或者公钥

## 挂载

请挂载到需要授权的路由链上

```typescript
// src/routers/post.router.ts
import { WebApp } from '@aomex/core';
import { jwt } from '../middleware/jwt.md';

const router = new Router({
  mount: [jwt.middleware],
});

router.get('/posts', {
  action: async (ctx) => {
    const { token, user } = ctx.jwt;
    const { userId } = user;
  },
});
```

## 签名

生成token一般是在公共路由完成

```typescript{13}
// src/routers/passport.router.ts
import { Router } from '@aomex/web';
import { jwt } from '../middleware/jwt.md';

export const router = new Router();

router.post('/login', {
  action: async (ctx) => {
    const user = await login();
    if (user) ctx.throw(401);

    const token = jwt.sign({ userId: user.id }, '密码 || 密钥');
    ctx.send({ token });
  },
});
```

::: warning
签名不要携带机密信息，因为任何人都可以解析token并查看其中内容。
:::
