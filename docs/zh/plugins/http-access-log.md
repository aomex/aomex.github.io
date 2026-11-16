---
outline: deep
---

# HTTP 访问日志

在请求结束时打一行访问日志：方法、URL、状态码、耗时等，用来看流量和慢接口。

**生产优先用 Nginx access_log**（或网关 / 负载均衡自带的访问日志）：格式统一、不占 Node 事件循环，也更容易进现有采集。`@aomex/http-access-log` 适合本地开发、没有反代，或要在日志里拼 **userId / 租户 / traceId** 这类只有进了应用才能拿到的字段。

```bash
pnpm add @aomex/http-access-log
```

## 靠前挂全站

需要应用内访问日志时，把 `httpAccessLog()` 尽量放在 `routers` **之前**：请求结束打一行 combined 风格记录；404、校验 400 也会记账。挂在后面容易对不齐整链耗时。

```typescript
import { httpAccessLog } from '@aomex/http-access-log';
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

无配置时类似 combined 的一行文本，默认走 logger 出口（本地多为控制台）。字段大致含：ip、method、url、statusCode、duration、contentLength。

::: warning
挂在 routers **后面** 时，整条链耗时和早退 404 可能对不上你想要的「全站审计」。
:::

customTokens 里回调参数是 WebContext：ctx.auth 等字段要在**内层鉴权跑完后**才能读到——访问日志在 await next() 之后写行，一般能拿到洋葱内层挂上的属性。若 customTokens 读 ctx.auth 却总是 -，确认洋葱顺序：鉴权在路由里、日志包在外层之前结束时，要把鉴权提高到 Router mount。

## 格式与落盘

| 能力 | 什么时候用 | 默认 |
| --- | --- | --- |
| `format` | 生产对齐 ELK/Loki 字段顺序 | 内置 combined 风格 |
| `transports` | 落盘、推到远端采集 | 控制台（跟 `logger`） |
| `customTokens` | 用户 ID、租户、traceId | — |
| `HttpAccessLogToken.*` | 拼 `ip` / `method` / `duration` 等 | 包内导出 |

### 生产：落盘

```typescript
import { HttpAccessLogToken, httpAccessLog } from '@aomex/http-access-log';
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

### 鉴权后写 userId

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

常与 [响应时间](/zh/plugins/response-time) 搭配：头里 X-Response-Time 给客户端/网关，日志里 duration 进平台。

| 环境 | 建议 |
| --- | --- |
| 本地直连 | 挂本插件打到控制台即可；慢接口排查可再加 `responseTime()` |
| 生产有 Nginx | **优先** `access_log`；应用层只在要自定义 token（用户、租户）时再开 |
| 生产无反代 | 本插件落盘或推到采集，并与业务日志分流 |

访问日志适合流量与耗时观测，**不要**当敏感操作的唯一审计来源——关键业务还要业务日志或审计表。Nginx 的 access_log 和应用内日志可以并存，但字段别做成两套互相打架的口径。

## 下一步

- 响应头耗时：[响应时间](/zh/plugins/response-time)
- 分级出口 / requestId：[日志](/zh/core/logger)