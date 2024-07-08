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
import { WebApp } from '@aomex/web';
import { traceMiddleware } from '@aomex/async-trace';

const app = new WebApp({
  mount: [
    traceMiddleware('生命周期', async (record) => {
      record.delta; // 总耗时
      record.children; // 子链路
    }),
  ],
});
```

获得记录后考虑使用日志插件上报。另外可以通过ctx获得更多的信息结合记录一起使用。

```typescript
// src/web.ts
import { WebApp, WebContext } from '@aomex/web';
import { traceMiddleware } from '@aomex/async-trace';

const app = new WebApp({
  mount: [
    traceMiddleware('生命周期', async (record, ctx: WebContext) => {
      console.log(ctx.request.href);
      console.log(ctx.request.ip);
    }),
  ],
});
```

在console应用中使用也没问题

```typescript
// src/cli.ts
import { ConsoleApp, ConsoleContext } from '@aomex/console';
import { traceMiddleware } from '@aomex/async-trace';

const app = new ConsoleApp({
  mount: [
    traceMiddleware('生命周期', async (record, ctx: ConsoleContext) => {
      console.log(ctx.input.command);
    }),
  ],
});
```

## 子链路

中间件只能统计单次执行的总耗时，而无法统计内部各个环节的实际耗时，也就无法对业务逻辑做进一步的分析和改进。比如一些属于数据库操作，一些属于第三方接口请求，还有一些为文件IO，当我们发现某次执行时间非常久，应该如何快速定位是哪个模块出现问题？为此框架提供了两种追踪方案：`方法装饰器`和`代码块`

### 追踪类的方法

插件采用**装饰器**语法追踪方法的执行耗时，并且要求方法返回`Promise`

```typescript
import { Service } from '@aomex/core';
import { traceMethod } from '@aomex/async-trace';

class UserService extends Service {
  @traceMethod('获取所有用户') // [!code ++]
  async findAll() {
    // ...
  }
}
```

标签省略时，框架会自动生成 `类名.方法名()` 这样的标签

```typescript
import { Service } from '@aomex/core';
import { traceMethod } from '@aomex/async-trace';

class UserService extends Service {
  @traceMethod('UserService.findAll()') // 可以简化为下面这行 // [!code --]
  @traceMethod() // [!code ++]
  async findAll() {
    // ...
  }
}
```

### 追踪代码块

有些代码不适合抽象到服务层，但也不影响耗时链路追踪

```typescript
import { traceBlock } from '@aomex/async-trace';

const result = await traceBlock('获取多个用户', async () => {
  await getUsers();
  await getPosts();
});
```
