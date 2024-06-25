# 安全报文

设置一系列安全相关的报头

## 安装

```bash
pnpm add @aomex/helmet
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { helmet } from '@aomex/helmet';

const appChain = mdchain.web.mount(helmet());
```

## 参数

请参考 helmet 官方文档：[github.com/helmetjs/helmet](https://github.com/helmetjs/helmet#helmet)
