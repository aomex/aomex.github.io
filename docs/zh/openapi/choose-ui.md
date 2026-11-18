---
outline: deep
---

# 怎么选文档 UI

aomex 提供三套文档页插件：[Swagger UI](/zh/openapi/swagger-ui)、[Redoc UI](/zh/openapi/redoc-ui)、[Scalar UI](/zh/openapi/scalar-ui)。它们读的是**同一份** OpenAPI 契约（落盘的 `openapi.json` / yaml，或运行时 `generateOpenapi`），差别在**阅读体验**和**能不能在页内试调**。

本页帮你按读者与场景选型；装包、挂 mount、`uriPrefix` / `enable` 等细节进各 UI 专页。契约怎么生成见 [生成OpenAPI](/zh/openapi/)。

## 一句话对照

| | [Swagger UI](/zh/openapi/swagger-ui) | [Redoc UI](/zh/openapi/redoc-ui) | [Scalar UI](/zh/openapi/scalar-ui) |
| --- | --- | --- | --- |
| 默认前缀 | `/swagger` | `/redoc` | `/scalar` |
| 页内试调 | 有（Try it out） | **没有** | 有 |
| 阅读体验 | 偏操作台，字段密 | 左侧导航、长文友好 | 现代排版，读 + 调兼顾 |
| 典型读者 | 开发、QA 联调 | 产品、对接方、交接文档 | 既要读又要随手打接口 |
| 包名 | `@aomex/swagger-ui` | `@aomex/redoc-ui` | `@aomex/scalar-ui` |

三套都是普通 Web 中间件：挂上就出页面，**不改变**业务路由上 `ctx` 的类型。全站开了 [envelope](/zh/web/envelope) 时，文档页会自动 `skipEnvelope`，不会被套壳。

## 按场景选

| 你现在在干嘛 | 优先选 | 原因 |
| --- | --- | --- |
| 本机 / 内网点开就调接口 | Swagger 或 Scalar | 页内能发真实请求；团队熟 Try it out 就 Swagger，想要更新一点的界面就 Scalar |
| 给对接方一份「说明书」URL | Redoc | 长文、schema 折叠更清爽；别指望对方在页里试调 |
| 对外 PDF / 周报附件式 API 说明 | Redoc | 印刷 / 滚动阅读体验更好 |
| 新人 onboarding：先读再试 | Scalar，或 Redoc + Swagger 并存 | 一套页里读完再试；或「读」与「调」拆成两个链接 |
| 旧项目同事只会 Swagger | 继续 Swagger | 学习成本最低；不必为换皮推倒重来 |
| 多种读者（产品 + 研发） | **并存**，分 `uriPrefix` | 同一份契约喂多套 UI，见下文 |

拿不准时：开发期先挂 **Scalar** 或 **Swagger** 之一就能干活；对外说明再加 **Redoc**。没有「必须三选一」——契约源只有一份。

## 能力边界（别踩错）

**页内试调** = 浏览器里填参数、带鉴权、打到真实（或网关后的）服务。Swagger 与 Scalar 有；Redoc **没有**。

```typescript
// Redoc 只负责展示契约——联调请另开 Swagger / Scalar / Postman
mount: [
  redocUI({ openapi: './openapi.json', uriPrefix: '/redoc-…' }),
  swaggerUI({ openapi: './openapi.json', uriPrefix: '/swagger-…' }),
  routers('./src/routers'),
],
```

::: warning
别让 QA / 对接方把 Redoc 当成「能点 Try it out 的 Swagger」。链接发错时，对方只能读不能调，会误以为接口坏了。
:::

其它边界：

- 文档 UI **不是** 鉴权方案：公网暴露等于交出 API 地图（可试调的还会交出试调入口）。
- 默认 `/swagger`、`/redoc`、`/scalar` 太好猜——`uriPrefix` 建议带**随机串**，并配合 `enable` / 内网 / 网关；细则见各 UI 专页。
- 动态 `openapi: () => generateOpenapi(...)` 必须传入与线上一致的 `app`，security / envelope 才不会和真环境两套皮。

## 同站并存

三套（或任意两套）可以挂在同一个 `WebApp` 上，**前缀必须分开**，契约可以共用一个文件：

```typescript
import { swaggerUI } from '@aomex/swagger-ui';
import { redocUI } from '@aomex/redoc-ui';
import { scalarUI } from '@aomex/scalar-ui';

mount: [ // [!code focus:13]
  swaggerUI({
    openapi: './openapi.json',
    uriPrefix: '/swagger-7c3e9a1f02b48d6e',
  }),
  redocUI({
    openapi: './openapi.json',
    uriPrefix: '/redoc-a1b2c3d4e5f60718',
  }),
  scalarUI({
    openapi: './openapi.json',
    uriPrefix: '/scalar-9f8e7d6c5b4a3210',
  }),
  routers('./src/routers'),
],
```

生产只对内网开放、或按 IP / token 开关时，三套的 `enable` 可以写成同一套判断（复制或抽成函数），避免漏关其中一套。

## 和「生成契约」怎么配合

| 契约从哪来 | 适合 UI 怎么读 |
| --- | --- |
| CI `aomex openapi` 落盘 | 三套都 `openapi: './openapi.json'`（或 yaml）——改路由后记得重新落盘 |
| 运行时 `generateOpenapi` | `openapi: () => generateOpenapi({ routers, app })`——省文件，注意同一份 `app` |
| 只给对接方静态站 | 往往只要 Redoc + 落盘文件；试调入口放内网 |

文档站高频在线扫全站路由费 CPU：生产对外页多数用**落盘 + UI 读文件**；开发期用动态生成更省事。完整落盘流程见 [生成OpenAPI](/zh/openapi/)。

## 选型速查

| 问题 | 答案 |
| --- | --- |
| 只要一个、要能试调 | Scalar 或 Swagger |
| 只要一个、只要好看的说明书 | Redoc |
| 产品读、研发调 | Redoc +（Swagger 或 Scalar） |
| 团队已有 Swagger 书签 / 录屏 | 先别换，加 Redoc / Scalar 即可 |
| 担心公网被扫 | 随机 `uriPrefix` + `enable`，三套同样处理 |

装好之后的配置、生产 `enable`、随机前缀示例：

- [Swagger UI](/zh/openapi/swagger-ui)
- [Redoc UI](/zh/openapi/redoc-ui)
- [Scalar UI](/zh/openapi/scalar-ui)

## 相关

- [生成OpenAPI](/zh/openapi/)
- [Tags 分组](/zh/openapi/tags) · [Markdown 文案](/zh/openapi/markdown)
