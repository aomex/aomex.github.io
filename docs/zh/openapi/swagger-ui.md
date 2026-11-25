---
outline: deep
---

# Swagger UI

在本机或内网挂一份**点开就能试调**的 API 文档。前提是一份 OpenAPI Document（落盘的 openapi.json 或运行时 `generateOpenapi`）。长文阅读可看 [Redoc UI](/zh/openapi/redoc-ui)；现代试调可看 [Scalar UI](/zh/openapi/scalar-ui)。多套 UI 可并存，**前缀别撞车**。

想先感受界面：[官方演示](https://petstore.swagger.io/)。契约从哪来：[生成OpenAPI](/zh/openapi/)。

```bash
pnpm add @aomex/swagger-ui
```

在 `WebApp.mount` 里挂 swaggerUI，开发同事打开 /swagger（或你设的 prefix）就能浏览并 Try it out。

## 落盘文件或动态 generateOpenapi

**CI 已落盘**（常见）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';

mount: [
  swaggerUI({ openapi: './openapi.json' }), // [!code highlight]
  routers('./src/routers'),
],
```

浏览器：/swagger（或 /swagger/index.html），规范 JSON 一般在同前缀下的 openapi.json。

**与线上路由同步**（不维护静态文件）：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { generateOpenapi } from '@aomex/openapi-generator';
import { app } from '@/app';

mount: [ // [!code focus:12]
  swaggerUI({
    uriPrefix: '/docs',
    openapi: () => { // [!code highlight]
      return generateOpenapi({
        routers: './src/routers',
        app,
      });
    },
  }),
  routers('./src/routers'),
],
```

swaggerUI 挂在 mount 里，类型上是普通 Web 中间件，不改编译器对业务路由的推断。openapi 传**路径字符串**或**返回 `Promise<Document>` 的函数**均可；传函数时请把**同一份** `WebApp`（`app`）交给 `generateOpenapi`，否则文档里的 security / envelope 会和真环境两套皮。

enable 若写成函数，参数里能拿到请求上下文，用来做内网门槛——返回值是 boolean 时可被类型检查兜住。

## uriPrefix 与生产 enable

| 选项 / 写法 | 什么时候用 |
| --- | --- |
| `openapi: './openapi.json'` | CI `aomex openapi` 落盘后托管 |
| `openapi: () => generateOpenapi(...)` | 省得提交契约文件；注意传入同一份 `app` |
| `uriPrefix` | 改默认 `/swagger`；建议带一段**随机串**，降低被扫到后滥用的风险 |
| `enable` | 生产公网要关文档或加 token / IP 白名单 |

默认 `/swagger`、`/redoc`、`/scalar` 太好猜。脚手架会写成类似 `/swagger-7c3e9a1f02b48d6e` 的前缀——外人扫常见路径拿不到文档页。随机串**不是鉴权**，只是抬高被撞到的成本；公网仍要配合 `enable`、内网或网关。

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
});
```

生产再加访问门槛：

```typescript
swaggerUI({
  openapi: './openapi.json',
  uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  enable: (ctx) => { // [!code highlight]
    const ipOk = ctx!.request.ip === '127.0.0.1';
    const tokenOk =
      ctx!.request.headers['x-docs-token'] === process.env.DOCS_TOKEN;
    return ipOk || tokenOk;
  },
});
```

挂的位置：一般放在 routers 之前或之后都能用，但**别和业务 API 前缀冲突**；和 redocUI / scalarUI 同时开时各自 `uriPrefix` 都要分开（也都建议带随机串）。

::: warning
公网裸奔 Swagger 等于把 API 地图和 Try it out 一起送人；随机前缀 + `enable` / 网络隔离一起用。
:::

动态 `openapi: () => generateOpenapi(...)` 忘了传与线上一致的 `app` 时，页面上会显示「无需鉴权」、也缺套壳形状，联调却 401。静态 openapi.json 模式下只改代码不更新文件，UI 仍是旧契约。

和 Redoc / Scalar 的对照、并存与场景选型见 [怎么选文档 UI](/zh/openapi/choose-ui)。

## 相关

- [怎么选文档 UI](/zh/openapi/choose-ui)
- [Scalar UI](/zh/openapi/scalar-ui) · [Redoc UI](/zh/openapi/redoc-ui)
- [生成OpenAPI](/zh/openapi/)