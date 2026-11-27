---
outline: deep
---

# Scalar UI

挂一份基于 [Scalar](https://github.com/scalar/scalar) 的 API 文档页：阅读体验偏现代，也能在页内试调。契约同样来自落盘的 openapi.json / yaml，或运行时 `generateOpenapi`。可与 [Swagger UI](/zh/openapi/swagger-ui) / [Redoc UI](/zh/openapi/redoc-ui) 同站并存，**uriPrefix 别撞车**（默认 `/scalar`）。

想先感受界面：[官方演示](https://galaxy.scalar.com/)。契约从哪来：[生成OpenAPI](/zh/openapi/)。

```bash
pnpm add @aomex/scalar-ui
```

在 `WebApp.mount` 里挂 `scalarUI`，打开 /scalar（或你设的 prefix）即可浏览。

## 落盘文件或动态 generateOpenapi

**CI 已落盘**（常见）：

```typescript
import { scalarUI } from '@aomex/scalar-ui';

mount: [
  scalarUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

也支持 yaml / yml 路径。浏览器：/scalar；同前缀下一般还有 openapi.json 供页面拉取。

**与线上路由同步**：

```typescript
import { scalarUI } from '@aomex/scalar-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

mount: [ // [!code focus:12]
  scalarUI({
    uriPrefix: '/api-docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
        docs: { openapi: '3.2.1' },
      });
    },
  }),
  routers('./src/routers'),
],
```

`scalarUI` 是普通 Web 中间件。`openapi` 传路径字符串或返回 Document（可异步）的函数；传函数时把**同一份** `WebApp`（`app`）交给 `generateOpenapi`，security / envelope 才不会和真环境两套皮。全站开了 [envelope](/zh/web/envelope) 时，文档页会自动 `skipEnvelope`，不会被套壳。

## uriPrefix、enable 与 headTags

| 选项 / 写法 | 什么时候用 |
| --- | --- |
| `openapi: './openapi.json'` / `.yaml` | CI `aomex openapi` 落盘后托管 |
| `openapi: () => generateOpenapi(...)` | 省得提交契约文件；注意同一份 `app` |
| `uriPrefix` | 默认 `/scalar`；建议改成带**随机串**的路径，降低被扫到后滥用的风险 |
| `enable` | 生产公网要关文档或加 token / IP 白名单 |
| `headTags` | 往文档页 `<head>` 插 favicon、额外 meta / link |

`/scalar`、`/swagger` 这类默认路径很容易被扫到。给前缀加一段随机串（如 `/scalar-7c3e9a1f02b48d6e`）只抬高撞库成本，**不能代替** `enable` / 内网隔离——思路与 [Swagger UI](/zh/openapi/swagger-ui) 相同。

```typescript
scalarUI({
  openapi: './openapi.json',
  uriPrefix: '/scalar-7c3e9a1f02b48d6e', // [!code highlight]
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

插站点图标：

```typescript
scalarUI({
  openapi: './openapi.json',
  headTags: [
    {
      tag: 'link',
      props: {
        rel: 'shortcut icon',
        type: 'image/x-icon',
        href: '/favicon.ico',
      },
    },
  ],
});
```

挂的位置：别和业务 API 前缀冲突；与 swaggerUI / redocUI 同时开时三个 `uriPrefix` 都要分开（也都建议带随机串）。

::: warning
公网裸奔文档 UI 等于把 API 地图（以及可试调能力）一起送人；随机前缀 + `enable` / 网络隔离一起用。
:::

动态 `openapi` 忘了传与线上一致的 `app` 时，页面上的鉴权 / 套壳形状会和联调对不上。静态文件模式下改路由后记得再跑 [生成OpenAPI](/zh/openapi/) 落盘。

和 Swagger / Redoc 的对照、并存与场景选型见 [怎么选文档 UI](/zh/openapi/choose-ui)。

## 相关

- [怎么选文档 UI](/zh/openapi/choose-ui)
- [Swagger UI](/zh/openapi/swagger-ui) · [Redoc UI](/zh/openapi/redoc-ui)
- [生成OpenAPI](/zh/openapi/)
