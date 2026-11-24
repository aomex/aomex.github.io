---
outline: deep
---

# AsyncAPI UI

给实时通道也挂一页「人能看懂」的文档，基于官方 `@asyncapi/react-component`。前提是手里有一份 AsyncAPI：可以是 CI 落盘的 `asyncapi.json`，也可以运行时现生成。

想先感受界面：[官方演示](https://asyncapi.github.io/asyncapi-react/)。契约怎么来：[生成 AsyncAPI](/zh/asyncapi/)。

它是挂在 **WebApp** 上的普通中间件（不是挂在 WebsocketApp 上）——文档页本身走 HTTP。

```bash
pnpm add @aomex/asyncapi-ui
```

## 读落盘文件（最常见）

CI 已经 `npx aomex asyncapi` 写出文件后，挂上即可。浏览器打开 `/asyncapi`（或 `/asyncapi/index.html`）；同前缀下一般还能拿到 `asyncapi.json` 原文件：

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';

mount: [
  asyncapiUI({ asyncapi: './asyncapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

`asyncapi` 也可以是 `.yaml` / `.yml` 路径。

## 每次请求现生成

不想把契约文件提交进仓库时，传一个函数，里面调 `generateAsyncapi`。`uriPrefix` 默认 `/asyncapi`，需要改路径时再写：

```typescript
import { asyncapiUI } from '@aomex/asyncapi-ui';
import { generateAsyncapi } from '@aomex/asyncapi-generator';

mount: [ // [!code focus:14]
  asyncapiUI({
    uriPrefix: '/asyncapi',
    asyncapi: async () => { // [!code highlight]
      return generateAsyncapi({
        channels: './src/channels',
        docs: {
          asyncapi: '3.1.0',
          info: { title: 'Realtime', version: '1.0.0' },
        },
      });
    },
  }),
  routers('./src/routers'),
],
```

## 生产环境别裸奔

默认路径 `/asyncapi` 太好猜。脚手架式的做法是加一段随机串，并在公网用 `enable` 做 IP / 登录门槛。随机串**不是**鉴权，只是抬高被扫到的成本。可以和 Swagger / Redoc 同时挂，只要前缀别撞车。需要往文档页 `<head>` 塞 favicon 时再加 `headTags`。

```typescript
asyncapiUI({
  asyncapi: './asyncapi.json',
  uriPrefix: '/asyncapi-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => {
    return ctx?.request.ip === '127.0.0.1';
  },
});
```

## 下一步

- [生成 AsyncAPI](/zh/asyncapi/)
- [WebSocket 应用入口](/zh/websocket/)
- HTTP 侧文档 UI 对照：[怎么选文档 UI](/zh/openapi/choose-ui)
