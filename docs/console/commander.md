# 指令路由

像写接口一样写指令！

## 安装

```bash
pnpm add @aomex/commander
```

## 使用

```typescript
// ./src/middleware/console.chain.ts
import { mdchain } from '@aomex/core';
import { commanders } from '@aomex/commander';

const appChain = mdchain.console.mount(commanders('./src/commanders'));
```

别忘了把appChain挂载到应用入口

```typescript
// src/cli.ts
import { ConsoleApp } from '@aomex/console';
import { appChain } from './src/middleware/console.chain'; // [!code ++]

const app = new ConsoleApp({
  mount: appChain, // [!code ++]
});

const code = await app.run();
process.exit(code);
```

## 第一个指令

```typescript
// ./src/commanders/say.ts
import { Commander } from '@aomex/commander';

export const commander = new Commander();

commander.create('say', {
  action: (ctx) => {
    console.log('Hello World');
  },
});
```

在终端执行这个指令看看会输出什么：

```bash
npx aomex say
```

不出意外的话，终端打印了一行文字：**Hello World**

## 快速查看指令

我们不妨先补充一下路由的说明文档

```typescript
// ./src/commanders/say.ts
import { Commander } from '@aomex/commander';

export const commander = new Commander();

commander.create('say', {
  docs: {
    summary: '打招呼',
    description: '打招呼详情',
  },
  action: (ctx) => {
    console.log('Hello World');
  },
});
```

接着执行`npx aomex -h`，可以看到下面一段文字

```txt{4}
aomex [指令] [选项]

命令：
  aomex say  打招呼

选项：
  -v, --version  显示aomex版本号     [布尔]
  -h, --help     显示帮助信息         [布尔]
```
