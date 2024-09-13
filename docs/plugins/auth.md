# 身份认证

请求一些私有资源时，需要识别用户信息后，才能确定该请求应该返回哪部分资源。使用身份认证中间件可以自动识别身份并在上下文携带可用的身份数据。

## 安装

```bash
pnpm add @aomex/auth
```

## 使用

```typescript
// src/web.ts
import { WebApp } from '@aomex/core';
import { authentication } from '@aomex/auth';
import { bearerAdapter } from '@aomex/auth-bearer-adapter';

const app = new WebApp({
  mount: [authentication(bearerAdapter())],
});
```

使用之前，我们需要知道身份信息从哪里获取并如何解析，因此引入了适配器的策略。
