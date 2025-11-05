# Bearer Token策略

使用一段普通的token令牌作为身份依据

## 安装

```bash
pnpm add @aomex/auth-bearer-strategy
```

## 使用

```typescript
import { Auth } from '@aomex/auth';
import { BearerStrategy } from '@aomex/auth-bearer-strategy';

export const auth = new Auth({
  strategies: {
    bearer: new BearerStrategy({}),
  },
});
```

## 参数

### onLoaded

**签名：**`(token: string, ctx: WebContext) => Promise<T | false>`

获取令牌后，需要返回这个token相应的身份数据，比如：`{ id: 1, name: 'abc' }`。如果token是无效的，请直接返回`false`

返回的身份数据在路由中可直接使用

```typescript{4-7,14,17}
export const auth = new Auth({
  strategies: {
    bearer: new BearerStrategy({
      async onLoaded(token, ctx) {
        // 返回值的类型会被反向推导到中间件
        return { id: 1, name: 'abc', scopes: [] };
      },
    }),
  },
});

router.get('/api', {
  mount: [
    auth.authenticate('bearer'),
  ],
  action: (ctx) => {
    console.log(ctx.auth.bearer.data); // { id: 1, name: 'abc' }
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
      async onLoaded(token, ctx) {
        return { id: 1, name: 'abc', scopes: [] };
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
    auth.authenticate('bearer').authorize('create', 'update')
  ],
  action: (ctx) => {},
});

router.get('/api', {
  mount: [
    auth.authenticate('bearer'),
    // 独立式
    auth.authorize('bearer', 'create', 'update')
  ],
  action: (ctx) => {},
});
```

### tokenLoaders

**签名：**`TokenLoaderItem[]`<br>
**默认值：**`[{ type: 'header', key: 'authorization' }]`

允许从不同的位置获取令牌，并按照数据顺序依次寻找，直到找到令牌。

type包含：**header**, **body**, **query**, **cookie**<br>
header的key建议使用`authorization`，其它源的key建议使用`access_token`

## 方法

### signature

**签名：**`(algorithm: string, uniqueKey?: string | number) => string`

strategy包含一个生成token的方法

```typescript
const token = auth.strategy('bearer').signature('md5');
```
