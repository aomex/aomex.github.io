# 链路追踪

追踪从请求到响应的中间操作以及记录耗时。

| 平台    | 支持度 |
| ------- | ------ |
| Web     | 支持   |
| Console | 支持   |

## 安装

```bash
pnpm add @aomex/async-trace
```

## 挂载

```typescript
// src/web.ts
import { WebApp } from '@aomex/core';
import { traceMiddleware } from '@aomex/async-trace';

const app = new WebApp({
  mount: [
    traceMiddleware('生命周期', (record) => {
      record.delta; // 总耗时
      record.children; // 子记录
    }),
  ],
});
```

获得记录后考虑使用日志插件上报

## 追踪类的方法

插件采用**装饰器**语法追踪方法的执行耗时，并且要求方法返回`Promise`

```typescript
import { Service } from '@aomex/core';
import { traceMethod } from '@aomex/async-trace'; // [!code ++]

class UserService extends Service {
  @traceMethod('find all users') // [!code ++]
  async findAll() {
    // ...
  }
}
```

## 追踪代码块

有些代码不适合抽象到服务层，但也不影响耗时链路追踪

```typescript
import { traceBlock } from '@aomex/async-trace'; // [!code ++]

const result = await traceBlock('', async () => {
  await getUsers();
  await getPosts();
});
```
