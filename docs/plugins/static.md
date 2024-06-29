# 静态文件

如果找不到合适的地方存储前端文件，则利用现有服务分发能降低复杂度，还能免去跨域的烦恼

## 安装

```bash
pnpm add @aomex/serve-static
```

## 使用

```typescript
import { WebApp } from '@aomex/web';
import { serveStatic } from '@aomex/serve-static';

const app = new WebApp({
  mount: [serveStatic({ root: '/public' })],
});
```

如果项目下有一个文件`/public/foo.txt`，则可以访问：[http://localhost:3000/foo.txt](http://localhost:3000/foo.txt)

## 参数

### root

类型：`string`

服务的根目录，请勿设置成根目录，否则源码可能被访问

### indexFile

类型：`string`<br>
默认值：`index.html`

没有指定文件名时，自动访问这个文件

### useCompressedFile

类型：`boolean`<br>
默认值：`true`

使用压缩过后的文件，如果未找到则继续使用源文件。支持后缀：

- .gz
- .br

### cacheControl

类型：`object`

设置 Cache-Control 报文，参考 [MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Cache-Control)

#### > publicOrPrivate

类型：`public | private`<br>
默认值：`public`

是否共享缓存

- `public` 表明响应可以被任何对象（包括：发送请求的客户端，代理服务器，等等）缓存，即使是通常不可缓存的内容。（例如：1.该响应没有max-age指令或Expires消息头；2. 该响应对应的请求方法是 POST 。）
- `private` 表明响应只能被单个用户缓存，不能作为共享缓存（即代理服务器不能缓存它）。私有缓存可以缓存响应内容，比如：对应用户的本地浏览器

#### > maxAge

类型：`number`<br>
默认值：`0`

缓存的内容将在N毫秒后失效, 这个选项只在HTTP 1.1可用, 并如果和Last-Modified一起使用时, 优先级较高

#### > immutable

类型：`boolean`<br>
默认值：`false`

表示响应正文不会随时间而改变。资源（如果未过期）在服务器上不发生改变，因此客户端不应发送重新验证请求头（例如If-None-Match或 If-Modified-Since）来检查更新，即使用户显式地刷新页面

#### > noCache

类型：`boolean`<br>
默认值：`false`

在发布缓存副本之前，强制要求缓存把请求提交给原始服务器进行验证 (协商缓存验证)

#### > noStore

类型：`boolean`<br>
默认值：`false`

缓存不应存储有关客户端请求或服务器响应的任何内容，即不使用任何缓存
