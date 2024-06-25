# 压缩内容

Web请求响应体积太大时，会消耗额外的服务器带宽以及花费更多时间用于内容的下载，甚至影响到用户的访问体验。因此我们希望使用[gzip](https://www.gzip.org)或者[brotli](https://github.com/google/brotli)算法压缩响应内容的体积。

## 安装

```bash
pnpm add @aomex/compress
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { compress } from '@aomex/compress';

export const appChain = mdchain.web.mount(compress());
```

## 参数

### filter

**类型：** `(contentType: string) => boolean`<br>
**默认值：** [compressible](https://www.npmjs.com/package/compressible)

根据响应的`content-type`确定是否需要压缩。如果存在`ctx.needCompress=true`，则该属性会被直接忽略<br>

### threshold

**类型：** `number | string`<br>
**默认值：** 1024<br>
最低要求的压缩体积。数字或者不带单位时，单位为`byte`。也可以传入带单位的字符串。

- 1259
- '1024'
- '100byte'
- '23kb'
- '1024mb'
- '3gb'

## 上下文

### needCompress

**类型：** boolean<br>
**默认值：** false<br>

插件暴露出来的属性，允许响应`强制开启`压缩功能<br>

```typescript
export const router = new Router({ mount: appChain });

router.get('/users', {
  action(ctx) {
    ctx.needCompress = true;
    ctx.send('small');
  },
});
```
