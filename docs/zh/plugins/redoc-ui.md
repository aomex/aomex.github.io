---
outline: deep
---

# Redoc UI

给产品、对接方一份**适合长文阅读**的 API 说明：左侧导航、折叠 schema，比 Swagger 清爽。Redoc **不能在页内直接试调**——联调仍靠 [Swagger UI](/zh/plugins/swagger-ui) 或自己的客户端。两份 UI 可以同站并存，注意 **路由前缀不要重复**。

契约来源：[OpenAPI 生成](/zh/plugins/openapi) · [OpenAPI 落盘](/zh/console/openapi)。

```bash
pnpm add @aomex/redoc-ui
```

mount 里挂 redocUI，团队打开 /redoc（默认）即可读同一份 OpenAPI（JSON 或 YAML 路径都行）。

## 与 Swagger 分前缀并存

```typescript
import { redocUI } from '@aomex/redoc-ui';
import { generateOpenapi } from '@aomex/openapi';
import { app } from './app.js';

mount: [ // [!code focus:13]
  redocUI({
    openapi: './openapi.yaml', // [!code highlight]
    // 或与 Swagger 一样用函数：
    // openapi: () => {
    //   return generateOpenapi({
    //     routers: './src/routers',
    //     app,
    //   });
    // },
  }),
  routers('./src/routers'),
],
```

需要和 Swagger 并存时：

```typescript
mount: [
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger' }),
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc' }), // [!code highlight]
  routers('./src/routers'),
],
```

::: warning
Redoc **不能在页内试调**；别让 QA 把它当成 Swagger 替代品。与 Swagger 并存时两个 uriPrefix 要分开（如 /redoc 与 /swagger）。
:::

与 Swagger UI 类似：redocUI 是 Web 中间件配置，不改变业务路由上 ctx 的类型。openapi 为字符串路径或异步返回 Document 的函数；函数写法下 `generateOpenapi` 的选项类型与 [OpenAPI 生成](/zh/plugins/openapi) 篇一致。

访问控制、uriPrefix、enable 等选项和 Swagger 插件**同一套思路**——具体字段以安装包的类型提示为准，按类型补全即可。

## 何时用 Redoc 而非 Swagger

| 什么时候用 | 建议 |
| --- | --- |
| 对外 PDF / 交接文档 | Redoc 阅读体验更好，落盘契约 + 固定 URL |
| 开发自测、调接口 | 再加 Swagger UI 或 Postman |
| 契约频繁变 | `openapi: () => generateOpenapi(...)`，或 CI 落盘后两者共读一份文件 |
| 生产暴露 | 与 Swagger 一样用 `enable` / 内网 / 网关鉴权 |

静态 openapi.yaml 路径写错或构建未拷贝文件时，线上会 404。契约走落盘时，改路由后记得跑 [OpenAPI 落盘](/zh/console/openapi)。

## 相关

- [Swagger UI](/zh/plugins/swagger-ui)
- [OpenAPI 生成](/zh/plugins/openapi)
- [OpenAPI 落盘](/zh/console/openapi)