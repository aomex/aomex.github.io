---
outline: deep
---

# 美化 JSON

开发时在浏览器里看 **带缩进的 JSON**，省得在一行长字符串里找字段。生产默认关——否则响应体积明显变大（移动端尤其亏），公开 API 还不该靠 query 放大 body。

```bash
pnpm add @aomex/pretty-json
```

## 开发环境全站挂载

`prettyJson()` 在 `await next()` **之后**把 JSON 响应改成带缩进文本，挂进 `WebApp.mount` 即可；生产用 `enable: false` 或只靠 `?pretty` 按需打开。

```typescript
import { prettyJson } from '@aomex/pretty-json';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
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

普通 WebMiddleware；ctx 无额外字段。效果是 Content-Type 仍为 JSON 时 body 变成 JSON.stringify(..., null, spaces) 的可读文本；对象模式可读流会走流式 stringify。

## enable 与 query 开关

| 选项 | 什么时候用 | 默认 |
| --- | --- | --- |
| `enable` | 生产务必 `false`；内网调试工具可单独开 | `true` |
| `query` | 不全站美化，仅 `?pretty` 时生效 | — |
| `spaces` | 团队习惯 2 或 4 空格 | `2` |

```typescript
prettyJson({ spaces: 4 });
```

### 仅内网 / 按需

```typescript
prettyJson({
  enable: false,
  query: 'pretty', // [!code highlight]
});
// GET /internal/debug/state?pretty
```

| 环境 | 建议 |
| --- | --- |
| 本地 | `enable: true` 或只用 `?pretty` |
| 生产 | `enable: false`；别让公开路由靠 query 放大响应 |

大列表全量 pretty 时体积可能是紧凑 JSON 的数倍，Postman 也会卡。与 [Compress](/zh/plugins/compress) 叠用时能压一点体积，但根源仍是 pretty 变长了 body。

## 下一步

- JSON 业务形态：[约束响应](/zh/web/response)
- 压体积：[Compress](/zh/plugins/compress)
- 开发期文档 UI：[Swagger UI](/zh/openapi/swagger-ui)