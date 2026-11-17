---
outline: deep
---

# Web 应用入口

把 HTTP 服务跑起来：[combineServices](/zh/core/service) 备好 services 和 logger，`new WebApp` 填齐必填项，用 `routers('./src/routers')` 挂上路由。下面顺带说明整站语言、客户端 IP、请求体上限，以及路由里 ctx.send / ctx.throw / ctx.redirect 的用法。

```bash
pnpm add @aomex/web @aomex/common @aomex/logger
pnpm add tsx -D
```

业务服务用 [combineServices](/zh/core/service) 注册；WebApp 必须拿到它的返回值，以及对应的 logger 实例。

```typescript
// src/services/index.ts
import { combineServices } from '@aomex/common';

export const services = await combineServices(
  { logger: () => import('./logger.service.js') },
  { eager: ['logger'] }, // [!code highlight]
);
```

```typescript
// src/web.ts
import { routers, WebApp } from '@aomex/web';
import { services } from './services/index.js';

const app = new WebApp({ // [!code focus:7]
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [routers('./src/routers')], // [!code highlight]
});

app.listen(3000, () => {
  console.log('HTTP 服务已启动');
});

declare module '@aomex/web' {
  namespace WebApp {
    type T = WebApp.Infer<typeof app>;
    interface Props extends T {}
  }
}
```

`new WebApp({ ... })` 里漏掉 services、logger、language、proxyIP 任一必填项，编译器会直接报错。全局 mount 里用 `middleware.web` 往 ctx 挂了字段，却不上面的 `declare module` 时，运行时有值、类型里没有，业务里容易到处 as。路由若挂了 [response()](/zh/web/response)，ctx.send / ctx.throw 的 body 形状会跟着声明收窄。

::: warning
全局 mount 往 ctx 挂了字段却没写 `declare module` 时，运行时有值、类型里没有，业务里容易到处 as。
:::

```bash
node --import tsx/esm --watch src/web.ts
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可。建议把启动命令写进 package.json 的 scripts，团队统一用 pnpm start。

下面字段都在 `new WebApp({ ... })` 里动。路由只管「这条路径做什么」；这些是「整站怎么跑」。

## services 与 logger

`services` 是业务服务容器（查库、缓存、发信等都挂在这里），用 [combineServices](/zh/core/service) 组装后交给 WebApp。进程关停时，框架会在销毁阶段对已加载的服务调 `destroy`，用来关连接、刷日志。

`logger` 必须单独再传一份（通常就是 `services.logger`）：路由和中间件里的 `ctx.logger` 用的就是这个实例，和构造参数是同一引用。

```typescript
const app = new WebApp({
  services, // [!code highlight]
  logger: services.logger, // [!code highlight]
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
});
```

## language

决定 **body() / query() 校验失败、框架内置提示**用哪种语言。语言码用 `zh-CN`、`en-US`（连字符；别写 `zh_CN`）。管的是框架侧文案，不是前端 Ant Design / Day.js 的 locale，也不是业务词条——业务多语言见 [高级：业务国际化](/zh/advanced/i18n)。

| 模式 | 什么时候用 |
| --- | --- |
| `fixed` + `language` | 内网后台、单语种 SaaS，不必读请求头 |
| `dynamic` | 公开多端 API，按请求协商 |
| `header: 'accept-language'` | 浏览器、标准客户端（按 RFC `q` 排序） |
| `header: 'x-language'` | App 自定义头（逗号分隔，一般忽略 `q`） |
| `fallback` | 头缺失或都不认识时的兜底 |

固定语言：

```typescript
language: { mode: 'fixed', language: 'zh-CN' },
```

按 Accept-Language 协商：

```typescript
language: {
  mode: 'dynamic', // [!code highlight]
  header: 'accept-language',
  fallback: 'zh-CN',
},
```

自定义头：

```typescript
language: {
  mode: 'dynamic',
  header: 'x-language', // [!code highlight]
  fallback: 'zh-CN',
},
```

自测：

```bash
curl -H 'Accept-Language: en-US' http://localhost:3000/users
```

::: warning
别在很晚的中间件里才设语言——前面的 body() / query() 可能已经按默认语报过错了；交给 WebApp.language 才能罩住框架文案。Console 侧只能写死字符串，见 [Console 应用入口](/zh/console/#language)。
:::

## proxyIP

填充 `ctx.request.ip`。配错等于限流和风控看错人。

| 模式 | 什么时候用 |
| --- | --- |
| `detect` | 本机 `tsx`、单测；前面有没有反代不确定，先能跑通 |
| `specify` | 公网生产：只信自家反代写的头，防客户端伪造 `X-Forwarded-For` |

```typescript
proxyIP: { mode: 'detect' },
```

::: warning
公网生产别长期用 detect：客户端能伪造常见代理头，限流和审计会认错人。上线应改 specify 并只信自家反代写的头。
:::

```typescript
proxyIP: {
  mode: 'specify', // [!code highlight]
  header: 'x-forwarded-for',
  hops: 1,
},
```

hops 要和真实代理层数一致，否则读到上一跳内网地址或 CDN 节点，登录异地提醒等风控都会歪。

| 拓扑 | 常见做法是这样配 |
| --- | --- |
| Node 直连公网 / 开发机直连 | `detect` 或 `specify` 且不读代理头 |
| 单层 Nginx → Node | `specify` + `x-forwarded-for`，`hops: 1` |
| CDN + 自家 Nginx | `x-forwarded-for`，`hops: 2`（按实际层数改） |
| 流量只经 Cloudflare | `specify` + `cf-connecting-ip`，`hops: 1` |

```typescript
proxyIP: {
  mode: 'specify',
  header: 'cf-connecting-ip', // [!code highlight]
  hops: 1,
},
```

## mount

`mount` 是整站中间件队列：每个请求都会按数组顺序走进来（洋葱模型，可在 `await next()` 前后做事）。跨域、全站鉴权、访问日志、以及 `routers('./src/routers')` 扫出来的接口，都挂在这里。

只影响某一组 URL 的逻辑，请放到 [Router](/zh/web/router) 或单条路由的 mount，别全塞进 WebApp。

```typescript
import { middleware } from '@aomex/common';
import { routers, WebApp } from '@aomex/web';

const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  mount: [ // [!code focus:9]
    middleware.web(async (ctx, next) => { // [!code highlight]
      const start = Date.now();
      await next();
      const cost = Date.now() - start;
      const { method, url } = ctx.request;
      await ctx.logger.info(`${method} ${url} ${cost}ms`);
    }),
    routers('./src/routers'),
  ],
});
```

## shutdown

进程收到 `SIGTERM` / `SIGINT`（例如 `docker stop`、Ctrl+C、K8s 滚动发布）时，WebApp 会做**优雅关停**：先停止接受新连接，等在途请求尽量跑完，再销毁 services，最后以退出码 0 结束进程。

`timeout` 是最长等待时间（默认约 **5 秒**，可写毫秒数或 `'10s'` 这类时长字符串）。到期还有连接时，会强制断开，避免进程卡死拖垮发布。

```typescript
shutdown: { timeout: 10_000 },
```

本地开发很少改；生产若有上传、长轮询、慢查询，可按最坏请求耗时调大。关停期间新请求进不来——负载均衡应先摘掉实例再发信号。用了 [clusterListen](/zh/advanced/cluster#clusterlisten) 时，primary 自己也会收信号并协调各 worker 退出。

## body 全站配额

上传接口或开放大 JSON 的 webhook 前，先看默认够不够；不够就在应用级收紧或放宽。

| 类型 | 典型 Content-Type | 默认（可参考） |
| --- | --- | --- |
| `payload` | JSON、urlencoded、text 等整包进内存 | 约 `2mb`，超限 **413** |
| `formData` | `multipart/form-data` | 单文件约 `50mb`、文件数 / 字段数有上限 |

```typescript
const app = new WebApp({
  services,
  logger: services.logger,
  language: { mode: 'fixed', language: 'zh-CN' },
  proxyIP: { mode: 'detect' },
  body: { // [!code focus:8]
    payload: { maxSize: '1mb' }, // [!code highlight]
    formData: {
      maxFileSize: '20mb',
      maxFiles: 5,
      maxFields: 50,
    },
  },
  mount: [routers('./src/routers')],
});
```

路由上的 [body()](/zh/web/body) 若声明了文件字段，会与应用级 formData 上限**取更严**的一方。上传细节见 [文件上传](/zh/web/attach)。

开放 webhook 或大 JSON 前先看默认配额：整包先进内存，超限是 **413**，和校验失败的 **400** 不是一回事；只改路由、不改应用级 body.payload 往往不够。

## envelope

需要**成功和失败共用同一种 JSON 外壳**、外层 HTTP 固定 **200**（真实状态码写在 body 里）时，在 `new WebApp` 上配 `envelope`。路由里仍照常 `send` / `throw`，框架在写出前套壳。

声明树用 `envelope.success` / `envelope.payload` / `envelope.statusCode` 和可选的 `envelope.slot` 拼装；常与 [formatError](/zh/web/errors) 一起用。细节、跳过规则（重定向、204、SSE 等）见 [响应体套壳](/zh/web/envelope)。

## listen、http、https

`listen` 真正把 HTTP 服务绑到端口上；不调用它，进程里只有 App 对象，外面访问不到。`app.listen(port)` 等价于 `app.http({}).listen(port)`，走明文 HTTP。

```typescript
app.http({ keepAliveTimeout: 65_000 }).listen(3000);
```

```typescript
import fs from 'node:fs';
import path from 'node:path';

app
  .https({
    key: fs.readFileSync(path.resolve('ca', 'cert.key')),
    cert: fs.readFileSync(path.resolve('ca', 'cert.pem')),
  }) // [!code highlight]
  .listen(443);
```

生产更常见的是 Nginx / Caddy 终结 TLS，反代到 Node HTTP——同时要配准 proxyIP。

多进程、Docker scale、K8s 副本、PM2、`clusterListen` 见 [多进程与扩容](/zh/advanced/cluster)。

## ctx.send

在路由 action 或全局中间件里，省略状态码默认 **200**；201、204 等要显式写第一位参数。

```typescript
router.get('/ping', {
  action: async (ctx) => {
    ctx.send('plain text'); // [!code highlight]
  },
});
```

```typescript
router.post('/users', {
  action: async (ctx) => {
    const user = await createUser(ctx.body);
    ctx.send(201, { id: user.id }); // [!code highlight]
  },
});
```

```typescript
router.delete('/sessions/current', {
  action: async (ctx) => {
    await revokeSession(ctx);
    ctx.send(204); // [!code highlight]
  },
});
```

## ctx.throw

只用 **4xx / 5xx**。业务拒绝走 ctx.throw，别 throw new Error——公开的 4xx 不会当 5xx 刷脏日志。

```typescript
router.get('/users/:id', { // [!code focus:12]
  mount: [params({ id: rule.int().min(1) })],
  action: async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (!user) {
      ctx.throw(404); // [!code highlight]
    }
    if (!canView(ctx, user)) {
      ctx.throw(403, { code: 'FORBIDDEN' });
    }
    ctx.send(user);
  },
});
```

```typescript
ctx.throw(500, 'payment gateway timeout', { expose: true });
```

`expose: true` 时响应体会展示 message——别把 SQL、内部路径写进去。

## ctx.redirect

永久 **301**，临时常用 **302**（省略状态码时默认 302）。

```typescript
router.get('/old-profile', {
  action: async (ctx) => {
    ctx.redirect(301, '/profile'); // [!code highlight]
  },
});
```

```typescript
router.get('/login-done', {
  action: async (ctx) => {
    ctx.redirect('/dashboard'); // [!code highlight]
  },
});
```

## download、sse、logger

路由里还会用到这几个出口，专页写细，这里先认个脸：

- `ctx.download`：把文件流写给客户端；流结束后 Promise 才会 settled，适合「下完就删」的临时文件。
- `ctx.sse()`：服务端推送（Server-Sent Events），见 [SSE](/zh/web/sse)。
- `ctx.logger`：就是构造 WebApp 时传入的那个 logger；要给每条日志带 `requestId` 等，见 [日志 · withBindings](/zh/core/logger#请求级上下文withbindings)。

### app.on('error')

action / 中间件里没接住的异常，框架会 `emit('error', err, ctx)`。默认已按 `expose` 决定要不要打 `logger.error`；你再监听这个事件，适合接 Sentry、钉钉等旁路通知。

**别在这里改响应体**——时机往往已经晚了，容易和已写出的响应打架。全站统一的 JSON 错误形状用 [formatError](/zh/web/errors)；成功失败都要同一层外壳、外层固定 200 时用 [响应体套壳](/zh/web/envelope)。

## 下一步

- [接口路由](/zh/web/router)：按文件拆 URL 与 HTTP 动词
- [query](/zh/web/query) / [params](/zh/web/params) / [body](/zh/web/body)：入参校验三件套
- [约束响应](/zh/web/response)：让 TypeScript 与 OpenAPI 说同一种话
- [服务端推送 SSE](/zh/web/sse)：ctx.sse / stream / 断线续传
- [错误格式](/zh/web/errors)：`ctx.throw` 后的 JSON 错误体
- [响应体套壳](/zh/web/envelope)：统一 JSON 外壳、外层 HTTP 200
- [多进程与扩容](/zh/advanced/cluster)：Docker / K8s / PM2 / `clusterListen`