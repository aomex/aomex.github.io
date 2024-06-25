# 应用入口

对于web开发者，服务端最重要的能力就是提供接口(API)给客户端调用，这也是框架重点发力的一个环节。通过安装特定的插件，我们就能快速地实现接口能力

## 安装

```bash
pnpm add @aomex/web
pnpm add tsx -D
```

## 使用

框架需要监听宿主机上的某个端口，才能接收客户端请求

```typescript
// src/web.ts
import { middleware, mdchain } from '@aomex/core';
import { WebApp } from '@aomex/web';

const app = new WebApp({
  mount: mdchain.web.mount(
    middleware.web(async (ctx, next) => {
      await next();
      ctx.send(200, 'Hello World');
    }),
  ),
});

app.listen(3000, () => {
  console.log('服务已启动');
});
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
