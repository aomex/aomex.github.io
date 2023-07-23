# 创建服务

对于web开发者，服务端最重要的能力就是提供接口(API)给客户端调用，这也是框架重点发力的一个环节。通过安装特定的插件，我们就能快速地实现接口能力

## 安装

[![npm](https://img.shields.io/npm/v/@aomex/web?logo=npm&label=@aomex/web)](https://www.npmjs.com/package/@aomex/web)
[![npm](https://img.shields.io/npm/v/@aomex/router?logo=npm&label=@aomex/router)](https://www.npmjs.com/package/@aomex/router)

```bash
pnpm add @aomex/core @aomex/web @aomex/router
pnpm add typescript @types/node -D
```

## 脚本命令

`@aomex/web`内置了[ts-node](https://www.npmjs.com/package/ts-node)，因此可以直接运行.ts文件

```json
// package.json
{
  "scripts": {
    "start": "aomex-ts-node src/index.ts"
  },
  "dependencies": {}
}
```

## 监听端口

```typescript
// src/index.ts
import { middleware } from '@aomex/core';
import { WebApp } from '@aomex/web';

const app = new WebApp();

// 挂载中间件
app.mount(
  middleware.web(async (ctx, next) => {
    await next();
    ctx.send(200, 'Hello world');
  }),
);

// 启动node服务
app.listen(3000, () => {
  console.log('Server started');
});
```

接着在终端输入命令

```bash
pnpm start
```

打开浏览器访问：[http://localhost:3000](http://localhost:3000)，不出意外你能看见一行文字`Hello world`。
恭喜，服务已经启动，等下我就告诉你如何写接口。

但是等等，我们找到了一个未知的东西`middleware.web`。这我得解释一下，`middleware.pure`的意思就是纯粹，它的context不依赖于任何一个应用平台，所以别妄想它会提示什么有用的TS类型给你。而`middleware.web`是定制的，它携带了**app**、**request**、**response** 等与web平台相关的属性和方法（在类型提示方面）。因此，如果不是制作通用的适用于各个应用的中间件，我建议你最好使用定制的中间件。

- common -> middleware.pure
- **web** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-> middleware.web
- **console** &nbsp;&nbsp;-> middleware.console
