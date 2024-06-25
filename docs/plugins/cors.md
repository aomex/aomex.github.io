---
outline: deep
---

# 跨域共享

`CORS`，全称Cross-Origin Resource Sharing，是一种允许当前域（domain）的资源（比如html/js/web service）被其他域（domain）的脚本请求访问的机制，通常由于同域安全策略（the same-origin security policy），浏览器会禁止跨域请求。

## 安装

```bash:no-line-numbers
pnpm add @aomex/cors
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { cors } from '@aomex/cors';

const appChain = mdchain.web.mount(cors());
```

## 参数

### origin

**类型：** `string | Function`<br>
**默认：**`request.headers.origin`<br>

设置报头 Access-Control-Allow-Origin，表示该响应的资源是否被允许与给定的来源（origin）共享。对于不包含凭据的请求，也可以设为星号(\*)，表示同意任意跨源请求

### allowMethods

**类型：**`string[] | string`<br>
**默认：**`GET,HEAD,PUT,POST,DELETE,PATCH`<br>

设置报头 Access-Control-Allow-Methods，表示客户端所要访问的资源允许使用的方法或方法列表。

### exposeHeaders

**类型：**`string[]` | `string`<br>

响应报头 Access-Control-Expose-Headers 允许服务器指示那些响应报头可以暴露给浏览器中运行的脚本。

默认情况下，只暴露安全列表的响应报头：

- Cache-Control
- Content-Language
- Content-Length
- Content-Type
- Expires
- Last-Modified
- Pragma

也支持自定义：

```typescript
cors({
  exposeHeaders: ['Content-Encoding', 'Kuma-Revision'],
});
```

更多详细信息请参考[MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Access-Control-Expose-Headers)

### allowHeaders

**类型：**`string[] | string`<br>

设置报头 Access-Control-Allow-Headers

### maxAge

**类型：**`number` | `string`<br>

设置报头 Access-Control-Max-Age，表示 Access-Control-Allow-Methods 和 Access-Control-Allow-Headers 提供的信息可以被缓存的最长时间（秒）。
<br>
如果值为`-1`，表示禁用缓存，则每次请求前都需要使用 OPTIONS 预检请求

### credentials

**类型：** `boolean | Function`<br>
**默认：**`false`<br>

设置报头 Access-Control-Allow-Credentials，Credentials可以代表 cookies、authorization headers 或 TLS client certificates，需要与客户端 XMLHttpRequest.withCredentials 或 Fetch API 的 credentials 选项结合使用

```typescript
// XHR
const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://aomex.js.org', true);
xhr.withCredentials = true;
xhr.send(null);

// Fetch
fetch('https://aomex.js.org', {
  credentials: 'include',
});

// Axios
axios.create({
  uri: 'https://aomex.js.org',
  withCredentials: true,
});
```

### secureContext

**类型：**`boolean`<br>
**默认：**`false`<br>

响应头部增加 Cross-Origin-Opener-Policy 和 Cross-Origin-Embedder-Policy 这两个个报头

### privateNetworkAccess

**类型：**`boolean`<br>
**默认：**`false`<br>

处理请求报头 Access-Control-Request-Private-Network 并返回报头 Access-Control-Allow-Private-Network。
<br>
想了解专有网络的内容请[点击这里](https://github.com/WICG/private-network-access)
