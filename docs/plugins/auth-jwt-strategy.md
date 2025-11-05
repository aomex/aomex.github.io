# JWT策略

服务器无状态令牌(JSON web token)

## 安装

```bash
pnpm add @aomex/auth-jwt-strategy
```

## 使用

```typescript
import { Auth } from '@aomex/auth';
import { JwtStrategy } from '@aomex/auth-jwt-strategy';

export const auth = new Auth({
  strategies: {
    jwt: new JwtStrategy({
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

**签名：**`(payload: Payload; ctx: WebContext; token: string): Promise<VerifiedPayload | false>`

验证成功后的回调，对payload做额外处理。如果token或者payload无效，则返回`false`。

```typescript
const jwt = new JwtStrategy({
  secret: 'YOUR_SECRET',
  async onVerified(payload: { userId: number }) {
    return { id: payload.userId, name: '树先生', age: 30 };
  },
});

// 路由中使用
const router = new Router();
router.get('/api', {
  action: async (ctx) => {
    ctx.auth.jwt.data; // {id: 1, name: '树先生', age: 30}
  },
});
```

### onAuthorize

**签名：**`(...scopes) => Promise<boolean>`

身份认证后进行权限认证。中间件可以和身份认证一起使用，也可以单独使用，有利于灵活控制不同路由的权限。

```typescript{1,9-15,22-23,31-32}
type Scopes = 'create' | 'update' | 'retrieve' | 'delete';

const auth = new Auth({
  strategies: {
    bearer: new BearerStrategy({
      async onVerified(payload: { userId: number }) {
        return { id: payload.userId, name: '树先生', age: 30, scopes: [] };
      },
      onAuthorize(...scopes: Scopes[]) {
        // 获得 onLoaded 的返回值
        const user = this.getIdentity();
        // 取权限交集
        const accepted = intersection(scopes, user.scopes);
        return accepted.length > 0;
      },
    }),
  },
});

router.get('/api', {
  mount: [
    // 一体式
    auth.authenticate('jwt').authorize('create', 'update')
  ],
  action: (ctx) => {},
});

router.get('/api', {
  mount: [
    auth.authenticate('jwt'),
    // 独立式
    auth.authorize('jwt', 'create', 'update')
  ],
  action: (ctx) => {},
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
