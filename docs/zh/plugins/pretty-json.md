---
outline: deep
---

# 美化 JSON

开发时在浏览器里看 **带缩进的 JSON**，省得在一行长字符串里找字段。生产默认关——否则响应体积明显变大（移动端尤其亏），公开 API 还不该靠 query 放大 body。

```bash
pnpm add @aomex/pretty-json
```

## 开发环境全站挂载

`prettyJson()` 在 `await next()` **之后**把 JSON 响应改成带缩进文本，挂进 `WebApp.mount` 即可。本地按环境打开；生产用 `enable: false`。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';
import { logger } from '@/services/logger.service';

const app = new WebApp({
  services,
  logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:7]
    prettyJson({
      enable: process.env.NODE_ENV !== 'production', // [!code highlight]
      query: 'pretty',
    }),
    routers('./src/routers'),
  ],
});
```

普通 WebMiddleware；ctx 无额外字段。效果是 Content-Type 仍为 JSON 时 body 变成 `JSON.stringify(..., null, spaces)` 的可读文本；对象模式可读流会走流式 stringify。团队习惯 4 空格时加 `spaces: 4`（默认 `2`）。

## 生产按需：只认 ?pretty

全站美化进不了生产时，关掉 `enable`，只留 query 开关：访问 `/internal/debug/state?pretty` 才缩进。公开路由别依赖这个放大响应。

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
```

| 环境 | 建议 |
| --- | --- |
| 本地 | `enable: true`，或只用 `?pretty` |
| 生产 | `enable: false`；别让公开路由靠 query 放大响应 |

大列表全量 pretty 时体积可能是紧凑 JSON 的数倍，Postman 也会卡。与 [Compress](/zh/plugins/compress) 叠用时能压一点体积，但根源仍是 pretty 变长了 body。

## 下一步

- JSON 业务形态：[约束响应](/zh/web/response)
- 压体积：[Compress](/zh/plugins/compress)
- 开发期文档 UI：[Swagger UI](/zh/openapi/swagger-ui)
