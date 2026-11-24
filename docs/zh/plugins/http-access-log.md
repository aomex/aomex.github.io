---
outline: deep
---

# 访问日志

想在应用里看到「谁打了哪个接口、花了多久」——用 `@aomex/access-log` 的 `httpAccessLog()`。请求结束打一行。

**生产环境优先用 Nginx 的 access_log**（或网关自带的）。本包装这几种情况：本地开发、前面没有反代、以及日志里要拼 **userId / 租户 / traceId** 这类只有进了 Node 才能拿到的字段。

```bash
pnpm add @aomex/access-log
```

## 挂在 routers 之前

把 `httpAccessLog()` 放在 `routers` **之前**。请求走完整条洋葱后打一行；404、校验 400 也会记。挂太靠后，耗时和早退路径会对不齐你想要的「全站审计」。

```typescript
import { httpAccessLog } from '@aomex/access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:4]
    httpAccessLog(), // [!code highlight]
    routers('./src/routers'),
  ],
});
```

什么都不配时，默认打到控制台，大致是 combined 风格：ip、method、url、statusCode、duration、contentLength。本地直连挂上即可；排慢接口再加 [响应时间](/zh/plugins/response-time)。

::: warning
挂在 routers **后面** 时，整条链耗时和早退 404 可能对不上你想要的「全站审计」。
:::

## 改格式、落到文件

生产要对齐 ELK / Loki 字段顺序，或写到文件里，用 `format` + `transports`。`format` 建议用 `HttpAccessLogToken` 拼接，别手写容易拼错的占位符。

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/access-log';
import { FileTransport } from '@aomex/logger';

httpAccessLog({
  format: [
    HttpAccessLogToken.ip,
    HttpAccessLogToken.method,
    HttpAccessLogToken.url,
    HttpAccessLogToken.statusCode,
    HttpAccessLogToken.duration,
    HttpAccessLogToken.contentType,
  ].join(' '),
  transports: [new FileTransport({ file: './logs/access.log' })], // [!code highlight]
});
```

传空 `transports` 或 `disabled: true` 相当于关掉访问日志。生产有 Nginx 时，**优先**网关的 `access_log`；只有要自定义 token、或前面没有反代时，再开应用层落盘 / 推采集，并与业务日志分流。

## 拼上 userId

日志在 `await next()` **之后**写行，所以内层鉴权挂上的 `ctx.auth` 一般能读到。用 `customTokens` 往 `format` 里塞业务字段：回调拿到的是完整 `WebContext`。

```typescript
httpAccessLog({
  format: `${HttpAccessLogToken.method} ${HttpAccessLogToken.url} [userId] ${HttpAccessLogToken.statusCode}`,
  customTokens: { // [!code highlight]
    userId: (ctx) => {
      return String(ctx.auth?.bearer?.data?.userId ?? '-');
    },
  },
});
```

常与 [响应时间](/zh/plugins/response-time) 搭配：头里的 `X-Response-Time` 给客户端 / 网关看，日志里的 duration 进采集平台。

访问日志适合看流量和耗时，**不要**当成敏感操作的唯一审计——下单、改权限这类还是写业务日志或审计表。

## 下一步

- 响应头耗时：[响应时间](/zh/plugins/response-time)
- WebSocket 连接 / 消息访问日志：[访问日志（WebSocket）](/zh/websocket/access-log)
- 分级出口 / requestId：[日志](/zh/core/logger)
