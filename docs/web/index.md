# 应用入口

对于web开发者，服务端最重要的能力就是提供接口(API)给客户端调用，这也是框架重点发力的一个环节。通过安装特定的插件，我们就能快速地实现接口能力

## 安装

```bash
pnpm add @aomex/core @aomex/web
pnpm add tsx -D
```

## 使用

框架需要监听宿主机上的某个端口，才能接收客户端请求

```typescript
// src/web.ts
import { middleware } from '@aomex/core';
import { WebApp } from '@aomex/web';

const app = new WebApp({
  locale: 'zh_CN',
  mount: [
    middleware.web(async (ctx, next) => {
      await next();
      ctx.send(200, 'Hello World');
    }),
  ],
});

app.listen(3000, () => {
  console.log('服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

在终端输入指令

```bash
node --import tsx/esm --watch src/web.ts
```

接着在浏览器输入地址[http://localhost:3000](http://localhost:3000)，可以看到网页上输出文字 **Hello World**

启动脚本建议放到`package.json`里统一调用

```json{4}
// package.json
{
  "scripts": {
    "start": "node --import tsx/esm --watch src/web.ts"
  }
}
```

接着在终端输入命令

```bash
pnpm start
```

## i18n

应用默认采用`中文(zh_CN)`作为主要语言。如果需要切换到英文，则直接指定为`en_US`

```typescript{5}
import { middleware } from '@aomex/core';
import { WebApp } from '@aomex/web';

const app = new WebApp({
  locale: 'en_US',
});

app.listen(3000, () => {
  console.log('服务已启动');
});
```

## 错误日志

如果应用发生了错误，我们希望能收集上报给一些日志平台进行整理和分析，因此需要有一个入口能收集到错误日志：

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp();

app.on('error', (err, ctx) => {
  app.log(err);
  if (String(ctx.response.statusCode).startsWith(5)) {
    // 上报5xx的异常
  }
});
```

默认情况下，响应的文字是字符串类型，我们也可以在事件中更改响应类型：

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp();

app.on('error', (err, ctx) => {
  // 修改响应实体
  ctx.response.body = {
    status: 1,
    message: ctx.response.body,
  };
});
```

## 监听https

`app.listen`使用的是**http**协议，如果要使用**https**，我们一般会放在[nginx](https://nginx.org)服务然后代理到node服务。如果不想用nginx，也可以直接使用node来处理证书

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { WebApp } from '@aomex/web';

const app = new WebApp({ locale: 'zh_CN' });

app
  .https({
    // 密钥
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    // 公钥
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  })
  .listen(443);
```

## debug

生产环境下，debug模式会被默认关闭，框架会将服务端造成的异常(5xx)文字统一为状态码文字。比如500异常会响应`Internal Server Error`，无法看到具体的原因。

框架支持手动开关debug配置，开启后在生产环境页能响应真实错误。

```typescript
import { WebApp } from '@aomex/web';

const app = new WebApp({
  debug: process.env['NODE_ENV'] !== 'production', // [!code --]
  debug: process.env['NODE_ENV'] === 'development', // [!code --]
  debug: true, // [!code ++]
});
```
