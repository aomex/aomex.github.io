# JWT策略

服务器无状态令牌(JSON web token)

## 安装

```bash
pnpm add @aomex/auth-jwt-strategy
```

## 使用

```typescript
import { Authentication } from '@aomex/auth';
import { JwtStrategy } from '@aomex/auth-jwt-strategy';

export const auth = new Authentication({
  strategies: {
    jwt: new JwtStrategy<{ userId: number }>({
      secret: 'YOUR_SECRET',
    }),
  },
});
```

::: warning
签名不要携带私密信息，因为任何人都可以解析token并查看其中内容！建议只携带最基础的数据，比如用户编号
:::

## 参数

### secret

**签名：**`Secret`

密码，用于生成令牌和验证令牌

### publicKey + privateKey

使用非对称加密代替密码，可以有效地防止泄漏。

- `publicKey` 公钥，用于验证令牌
- `privateKey` 密钥，用于生成令牌

::: info
密钥对和密码提供一种就行了！
:::

### tokenLoaders

**签名：**`TokenLoaderItem[]`<br>
**默认值：**`[{ type: 'header', key: 'authorization' }]`

允许从不同的位置获取令牌，并按照数据顺序依次寻找，直到找到令牌。

type包含：**header**, **body**, **query**, **cookie**<br>
header的key建议使用`authorization`，其它源的key建议使用`access_token`

### verifyOptions

**签名：**`object`

验证令牌时的额外参数。需要和生成令牌时保持一致

### onVerified

**签名：**`(data: { payload: Payload; ctx: WebContext; token: string }): Promise<VerifiedPayload | false>`

验证成功后的回调，对payload做额外处理。如果token或者payload无效，则返回`false`。

如果最终的数据与令牌中存储的数据不一致，则需要传入泛型第二个参数：

```typescript
const jwt = new JwtStrategy<
  { userId: number },
  { id: number; name: string; age: number } // [!code ++]
>({
  secret: 'YOUR_SECRET',
  async onVerified({ payload }) {
    return { id: payload.userId, name: '树先生', age: 30 };
  },
});

// 路由中使用
const router = new Router();
router.get('/api', {
  action: async (ctx) => {
    ctx.jwt; // {id: 1, name: '树先生', age: 30}
  },
});
```

### legacySecretOrPublicKey

**签名：**`Secret[]`

更换密码或者密钥后，为了能验证旧的JWT令牌，请提供旧的密码或者公钥

## 方法

### signature

**签名：**`(payload: Payload, opts?: SignOptions): string`

该策略包含一个生成token的方法。该方法会自动设置密码

```typescript
const token = auth
  .strategy('jwt')
  .signature({ userId: 1 }, { expiresIn: '30d' });
```
