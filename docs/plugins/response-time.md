# 服务响应时间

在响应header中注入服务响应时间，报头插入数据格式：`x-response-time: 123ms`

## 安装

[![npm](https://img.shields.io/npm/v/@aomex/cors?logo=npm&label=@aomex/response-time)](https://www.npmjs.com/package/@aomex/response-time)

```bash:no-line-numbers
pnpm add @aomex/response-time
```

## 使用

```typescript
import { createResponseTime } from '@aomex/response-time';

app.mount(createResponseTime());
```

## 参数

### hrtime

类型：`boolean | undefined`<br>
默认：`true`<br>
是否需要包含毫秒值
