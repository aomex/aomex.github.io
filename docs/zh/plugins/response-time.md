---
outline: deep
---

# 响应时间

在每个响应头里写入服务端处理耗时（如 X-Response-Time），方便浏览器、网关、集成测试观测慢接口。无配置项，挂上即用。

```bash
pnpm add @aomex/response-time
```

## 与访问日志同排

`responseTime()` 无配置，挂在访问日志旁：请求结束后在响应头写入耗时。和 Nginx `access_log` / [httpAccessLog](/zh/plugins/http-access-log) 的 duration 互补（头给客户端/网关，日志给平台聚合）。生产访问日志仍优先边缘；本插件只解决「响应头里要不要带耗时」。

```typescript
import { responseTime } from '@aomex/response-time';
import { httpAccessLog } from '@aomex/http-access-log';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:5]
    responseTime(), // [!code highlight]
    httpAccessLog(),
    routers('./src/routers'),
  ],
});
```

使用 process.hrtime，头里常见形如 12.345ms。失败响应也会带上；错误路径可能合并进 HttpError.headers。

普通 WebMiddleware，不改 ctx 业务类型。你在 Network 面板看响应头即可，不必在 action 里手写。

## 响应头 vs 访问日志

| 输出 | 给谁看 | 经验 |
| --- | --- | --- |
| `X-Response-Time` | 浏览器、API 网关、测试断言 | 与路由改动无关，全站同一行为 |
| 访问日志 `duration` | 日志平台、告警、按路由聚合 | 见 [HTTP 访问日志](/zh/plugins/http-access-log) |

没有选项表：**要头里耗时就开，不要就不挂。** 一般放在 routers 前、靠近访问日志。

| 环境 | 建议 |
| --- | --- |
| 生产 | 常与 `httpAccessLog()` 一起开 |
| 本地 | 只 tail 控制台时可只留访问日志 |

X-Response-Time 不是端到端总耗时：前面还有网关、TLS、客户端排队。对外 API 若担心信息泄露，可在边缘剥掉头；内网/自有前端一般无所谓。只开 responseTime 不落盘时，排障高峰仍要日志聚合里的 duration（见 [HTTP 访问日志](/zh/plugins/http-access-log)）。

## 下一步

- 访问日志：[HTTP 访问日志](/zh/plugins/http-access-log)
- 分布式追踪：[链路追踪](/zh/plugins/async-trace)
- [中间件](/zh/core/middleware)