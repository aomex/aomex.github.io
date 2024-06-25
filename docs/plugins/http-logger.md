# 请求日志

记录所有http请求和响应

## 安装

```bash
pnpm add @aomex/http-logger
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { httpLogger } from '@aomex/pretty-json';

export const appChain = mdchain.web.mount(httpLogger());
```

## 内置token

```typescript
export enum HttpLoggerToken {
  request = '[request]',
  response = '[response]',
  method = '[method]',
  url = '[url]',
  statusCode = '[statusCode]',
  contentLength = '[contentLength]',
  contentType = '[contentType]',
  time = '[time]',
  duration = '[duration]',
  ip = '[ip]',
}
```

## 参数

### requestFormat

类型：`string`<br>
默认值：`[time] [request] [ip] [method] [url]`

请求输出格式，建议使用 **HttpLoggerToken** 拼接

### responseFormat

类型：`string`<br>
默认值：`[time] [response] [ip] [method] [url] [statusCode] [duration] [contentLength]`

响应输出格式，建议使用 **HttpLoggerToken** 拼接

### printer

类型：`(message: string) => void`<br>
默认值：`console.log`

日志输出函数。
::: warning
日志携带了颜色标记，如果想清除颜色，请使用`util.stripVTControlCharacters(message)` 过滤掉ASCII编码字符。
:::

```typescript
import { stripVTControlCharacters } from 'node:util';

httpLogger({
  printer: (msg) => {
    const pureMsg = stripVTControlCharacters(msg); // [!code ++]
    console.log(pureMsg);
  },
});
```

### customTokens

类型：`{ [key: string]: (ctx: WebContext) => string | Promise<string> }`

自定义关键词

```typescript
httpLogger({
  requestFormat: '[time] [href] [node_version]',
  customTokens: {
    href: (ctx) => ctx.request.href,
    node_version: () => process.versions.node,
  },
});
```
