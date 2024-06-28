# ETag

ETag 是URL的实体标签(Entity Tag)，用于标示URL对象是否改变。引入ETag是为了解决 [Last-Modified](https://datatracker.ietf.org/doc/html/rfc7232#section-2.2) 存在的一些问题。

![alt text](etag.png)

## 安装

```bash
pnpm add @aomex/etag
```

## 使用

```typescript
// src/web.ts
import { WebApp } from '@aomex/core';
import { etag } from '@aomex/etag';

const app = new WebApp({
  mount: [etag()],
});
```

## 参数

### week

类型：`boolean`<br>
默认：`false`

是否增加 `W/` 前缀，即弱校验
