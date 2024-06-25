# 美化JSON

响应的JSON数据没有换行和锁进，导致调试时阅读困难

## 安装

```bash
pnpm add @aomex/pretty-json
```

## 使用

```typescript
// ./src/middleware/web.chain.ts
import { mdchain } from '@aomex/core';
import { prettyJson } from '@aomex/pretty-json';

export const appChain = mdchain.web.mount(prettyJson());
```

## 参数

### enable

类型：`boolean`

是否启用中间件

### query

类型：`string`

在查询字符串找到指定的key时，强制启用中间件

### spaces

类型：`number`<br>
默认值：`2`

每行缩进空格数量
