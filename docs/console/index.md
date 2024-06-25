# 应用入口

揭开终端指令的神秘面纱

## 安装

```bash
pnpm add @aomex/core @aomex/console
```

## 初始化

```typescript
// src/cli.ts
import { ConsoleApp } from '@aomex/console';

const app = new ConsoleApp();

const code = await app.run();
process.exit(code);
```

恭喜，入口已经创建好，输入下面的命令试一下

```bash
npx aomex --help
```

## i18n

应用默认采用`中文(zh_CN)`作为主要语言。如果需要切换到英文，则直接指定为`en_US`

```typescript{5}
import { middleware } from '@aomex/core';
import { ConsoleApp } from '@aomex/console';

const app = new ConsoleApp({
  locale: 'en_US',
});

const code = await app.run();
process.exit(code);
```
