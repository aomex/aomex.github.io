# 服务响应时间

在响应header中注入服务响应时间，报头插入数据格式：`x-response-time: 123ms`

## 安装

```bash:no-line-numbers
pnpm add @aomex/response-time
```

## 使用

```typescript
// src/web.ts
import { WebApp } from '@aomex/core';
import { responseTime } from '@aomex/response-time';

const app = new WebApp({
  mount: [responseTime()],
});
```
